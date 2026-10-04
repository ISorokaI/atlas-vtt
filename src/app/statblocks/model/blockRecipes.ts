/**
 * Recipes (spec §7.5, §12.3): several blocks inserted at once, listed by the
 * part of a statblock they make, in the Add panel and the `/` menu.
 */

import { COMMON_RECIPES } from './recipes/commonRecipes';
import { PART_RECIPES } from './recipes/partRecipes';
import type { BlockRecipe, RecipeId } from './recipes/recipeKit';

export { MODIFIER_FORMULA } from './recipes/commonRecipes';
export type { BlockRecipe, RecipeGroup, RecipeIcon, RecipeId, RecipeResult } from './recipes/recipeKit';

export const BLOCK_RECIPES: readonly BlockRecipe[] = [...COMMON_RECIPES, ...PART_RECIPES];

export function recipeById(id: RecipeId): BlockRecipe | undefined {
  return BLOCK_RECIPES.find((recipe) => recipe.id === id);
}
