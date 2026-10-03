import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LibraryTemplate, TemplateLookup } from '../../../../src/app/statblocks/model/resolvedTypes';
import { CreationPrompt, type CreationPromptOptions } from '../../../../src/app/statblocks/editor/create/CreationPrompt';
import { NewStatblockButton, createStatblockMenuEntry } from '../../../../src/app/statblocks/editor/create/RoleMenu';
import { needsRoleMenu, roleChoicesOf, type RoleChoice } from '../../../../src/app/statblocks/editor/create/roleChoices';

afterEach(cleanup);

const named = (name: string): LibraryTemplate => ({ name } as LibraryTemplate);
const LOOKUP: TemplateLookup = {
  get: (id) => ({ 'builtin:generic-creature': named('Creature'), 'marsh-k7m2qa': named('Marsh creature') } as Record<string, LibraryTemplate>)[id] ?? null,
};
const MONSTER: RoleChoice = { roleId: 'monster', name: 'Monster', templateName: 'Marsh creature' };
const NPC: RoleChoice = { roleId: 'npc', name: 'NPC', templateName: 'NPC' };

describe('role choices', () => {
  it('names each role\'s template, the generic one where the library lacks it, none while the library loads', () => {
    const roles = [
      { id: 'monster', name: 'Monster', templateId: 'marsh-k7m2qa' },
      { id: 'beast', name: 'Beast', templateId: 'gone-aaaaaa' },
    ];
    expect(roleChoicesOf(roles, LOOKUP, false)).toEqual([
      { roleId: 'monster', name: 'Monster', templateName: 'Marsh creature' },
      { roleId: 'beast', name: 'Beast', templateName: 'Creature' },
    ]);
    expect(roleChoicesOf(roles, LOOKUP, true)[1]?.templateName).toBe('');
  });

  it('skips the menu for one role, unless it also offers the collection', () => {
    expect(needsRoleMenu([MONSTER], false)).toBe(false);
    expect(needsRoleMenu([MONSTER], true)).toBe(true);
    expect(needsRoleMenu([MONSTER, NPC], false)).toBe(true);
  });
});

describe('Create statblock in a context menu', () => {
  it('creates at once with one role', () => {
    const onChoose = vi.fn();
    const entry = createStatblockMenuEntry([MONSTER], onChoose);
    expect(entry).toMatchObject({ type: 'item', label: 'Create statblock' });
    if (entry.type === 'item') void entry.onClick();
    expect(onChoose).toHaveBeenCalledWith('monster');
  });

  it('opens the role menu with several: each role with its template muted, never repeating the name', () => {
    const entry = createStatblockMenuEntry([MONSTER, NPC], vi.fn());
    if (entry.type !== 'submenu' || typeof entry.children === 'function') throw new Error('expected a submenu');
    expect(entry.children).toEqual([
      expect.objectContaining({ type: 'item', label: 'Monster', hint: 'Marsh creature' }),
      expect.objectContaining({ type: 'item', label: 'NPC' }),
    ]);
    expect(entry.children[1]).not.toHaveProperty('hint');
  });
});

function prompt(options: Partial<CreationPromptOptions> = {}): { onDone: ReturnType<typeof vi.fn>; onGone: ReturnType<typeof vi.fn> } {
  const onDone = vi.fn();
  const onGone = vi.fn();
  render(
    <CreationPrompt
      doc={document}
      at={{ x: 400, y: 90 }}
      collections={[{ id: 'marsh', name: 'Marsh campaign' }, { id: 'city', name: 'City' }]}
      collectionId="marsh"
      offersCollection={false}
      choicesOf={() => [MONSTER, NPC]}
      onDone={onDone}
      onGone={onGone}
      {...options}
    />,
  );
  return { onDone, onGone };
}

describe('the prompt of commands and the file menu', () => {
  it('goes straight to the name with one role, and Enter creates', () => {
    const { onDone } = prompt({ choicesOf: () => [MONSTER] });
    expect(screen.queryByRole('menu')).toBeNull();
    const field = screen.getByRole('textbox', { name: 'New statblock' });
    expect(document.activeElement).toBe(field);

    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onDone).not.toHaveBeenCalled();
    fireEvent.change(field, { target: { value: '  Bog Hag ' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onDone).toHaveBeenCalledWith({ roleId: 'monster', collectionId: 'marsh', name: 'Bog Hag' });
  });

  it('asks for the role first, then names the statblock of that role', async () => {
    const { onDone } = prompt();
    const menu = screen.getByRole('menu', { name: 'Choose a role' });
    expect(menu.textContent).toContain('Marsh creature');
    expect(screen.queryByRole('textbox')).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /NPC/ }));
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull());
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'New statblock' }).textContent).toContain('NPC');

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'Mayor' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onDone).toHaveBeenCalledWith({ roleId: 'npc', collectionId: 'marsh', name: 'Mayor' });
  });

  it('backs out on Escape in the popover, and on Escape in the menu', async () => {
    const first = prompt({ choicesOf: () => [MONSTER] });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });
    expect(first.onDone).toHaveBeenCalledWith(null);
    cleanup();

    const second = prompt();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    await waitFor(() => expect(second.onDone).toHaveBeenCalledWith(null));
    await waitFor(() => expect(second.onGone).toHaveBeenCalled());
  });

  it('offers the collection at the menu\'s top where the entry point named none', async () => {
    const choicesOf = (id: string): RoleChoice[] => (id === 'city' ? [{ roleId: 'guard', name: 'Guard', templateName: 'NPC' }] : [MONSTER, NPC]);
    const { onDone } = prompt({ offersCollection: true, choicesOf });
    const chip = screen.getByRole('menuitem', { name: /Marsh campaign/ });
    act(() => { fireEvent.click(chip); });
    fireEvent.keyDown(chip, { key: 'ArrowRight' });
    fireEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'City' }));
    await waitFor(() => expect(screen.getByRole('menuitem', { name: /Guard/ })).toBeTruthy());
    expect(screen.queryByRole('menuitem', { name: /Monster/ })).toBeNull();

    fireEvent.click(screen.getByRole('menuitem', { name: /Guard/ }));
    const field = await screen.findByRole('textbox');
    fireEvent.change(field, { target: { value: 'Watch' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onDone).toHaveBeenCalledWith({ roleId: 'guard', collectionId: 'city', name: 'Watch' });
  });
});

describe('New statblock… in a dialog', () => {
  it('creates at once with one role', () => {
    const onChoose = vi.fn();
    render(<NewStatblockButton choices={[MONSTER]} onChoose={onChoose} />);
    fireEvent.click(screen.getByRole('button', { name: 'New statblock' }));
    expect(onChoose).toHaveBeenCalledWith('monster');
  });

  it('opens the role menu with several and says when it is open', async () => {
    const onChoose = vi.fn();
    const onMenuOpenChange = vi.fn();
    render(<NewStatblockButton choices={[MONSTER, NPC]} onChoose={onChoose} onMenuOpenChange={onMenuOpenChange} />);
    const trigger = screen.getByRole('button', { name: 'New statblock…' });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    await waitFor(() => expect(onMenuOpenChange).toHaveBeenLastCalledWith(true));

    fireEvent.click(screen.getByRole('menuitem', { name: /Monster/ }));
    expect(onChoose).toHaveBeenCalledWith('monster');
    await waitFor(() => expect(onMenuOpenChange).toHaveBeenLastCalledWith(false));
  });
});
