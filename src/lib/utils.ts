/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { normalizePrice } from './util';
import { apple_store_currency_map } from './constants'

// Type for a single scraped product, enriched with country info.
export type ScrapedProduct = {
  product: string;
  cost: string;
  countryCode: string;
  countryName: string;
  currency: string;
  pricingCurrency?: string;
};

// Type for the final data structure displayed in the table.
// Groups products by their name, price, and effective currency.
export type GroupedProduct = {
  product: string;
  currency: string;
  cost: number;
  countries: Set<string>;
};

// Type for the table sorting configuration.
export type SortConfig = {
  key: string;
  direction: 'ascending' | 'descending';
};

// Type for the exchange rates data structure.
export type ExchangeRates = Record<string, Record<string, number>>;


/**
 * Groups scraped products by product name. Each product name will have a list
 * of price points, with each price point containing the set of countries
 * where that price is available.
 */
export function groupProducts(allProducts: ScrapedProduct[]): Record<string, GroupedProduct[]> {
  const groupedByProductAndPrice = allProducts.reduce<Record<string, GroupedProduct>>((acc, item) => {
    const normalizedCost = normalizePrice(item.cost);
    if (isNaN(normalizedCost)) {
      return acc;
    }
    
    effectiveCurrency = apple_store_currency_map[item.countryCode]

    const key = `${item.product}-${effectiveCurrency}-${normalizedCost}`;
    if (!acc[key]) {
      acc[key] = {
        product: item.product,
        currency: effectiveCurrency,
        cost: normalizedCost,
        countries: new Set(),
      };
    }
    acc[key].countries.add(item.countryName);
    return acc;
  }, {});

  const finalGroupedData: Record<string, GroupedProduct[]> = {};
  for (const group of Object.values(groupedByProductAndPrice)) {
    if (!finalGroupedData[group.product]) {
      finalGroupedData[group.product] = [];
    }
    finalGroupedData[group.product].push(group);
  }

  return finalGroupedData;
}

/**
 * Sorts an array of grouped products based on the provided sort configuration.
 */
export function sortGroupedProducts(
  data: GroupedProduct[],
  sortConfig: SortConfig,
  conversionCurrency: string | null,
  exchangeRates: ExchangeRates
): GroupedProduct[] {
  const dataToSort = [...data];

  dataToSort.sort((a, b) => {
    let aValue: string | number | undefined;
    let bValue: string | number | undefined;

    const key = sortConfig.key as keyof GroupedProduct | 'convertedCost';

    const getConvertedValue = (item: GroupedProduct): number => {
      if (!conversionCurrency) {
        return sortConfig.direction === 'ascending' ? Infinity : -Infinity;
      }
      if (item.currency === conversionCurrency) {
        return item.cost;
      }
      const rate = exchangeRates[item.currency]?.[conversionCurrency];
      if (rate) {
        return item.cost * rate;
      }
      // Return a value that will push it to the end of the list if the rate isn't loaded
      return sortConfig.direction === 'ascending' ? Infinity : -Infinity;
    };


    switch (key) {
      case 'convertedCost':
        aValue = getConvertedValue(a);
        bValue = getConvertedValue(b);
        break;
      case 'countries':
        aValue = a.countries.size;
        bValue = b.countries.size;
        break;
      case 'product':
      case 'currency':
        aValue = a[key].toLowerCase();
        bValue = b[key].toLowerCase();
        break;
      case 'cost':
        aValue = a.cost;
        bValue = b.cost;
        break;
      default:
        return 0;
    }
    if (aValue === undefined || aValue < bValue) {
      return sortConfig.direction === 'ascending' ? -1 : 1;
    }
    if (bValue === undefined || aValue > bValue) {
      return sortConfig.direction === 'ascending' ? 1 : -1;
    }
    return 0;
  });

  return dataToSort;
}
