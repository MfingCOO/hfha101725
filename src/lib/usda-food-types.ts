export interface FoodData {
  foods: any[];
  foodSearchCriteria: FoodSearchCriteria;
  totalHits: number;
  currentPage: number;
  totalPages: number;
}

export interface FoodSearchCriteria {
  query: string;
  dataType: string[];
  pageSize: number;
  pageNumber: number;
  sortBy: string;
  sortOrder: string;
}

export interface BrandedFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  ingredients?: string;
  foodNutrients: FoodNutrient[];
  servingSize: number;
  servingSizeUnit: string;
  householdServingFullText?: string;
}

export interface FoodNutrient {
  nutrient: Nutrient;
  amount?: number;
}

export interface Nutrient {
  id: number;
  name: string;
  unitName: string;
}
