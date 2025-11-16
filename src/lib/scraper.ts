/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import axios from 'axios';

/**
 * Represents a single in-app purchase product.
 */
export type Product = {
  product: string;
  cost: string;
};

/**
 * An array of products.
 */
export type Products = Product[];

/**
 * Defines the signature for the function that scrapes product data.
 * @param countryCode - The two-letter country code (e.g., 'us', 'gb').
 * @param appId - The Apple App Store ID for the application.
 * @returns A promise that resolves to an array of products.
 */
export type GetProductsFn = (
  countryCode: string,
  appId: string
) => Promise<Products>;

/**
 * List of public CORS proxies. These can be unreliable.
 * The scraper will try them in order until one succeeds.
 */
const PROXY_URLS = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url='
];

/**
 * Scrapes In-App Purchase information from an Apple App Store page.
 *
 * NOTE: This function uses a list of public CORS proxies to bypass
 * browser security restrictions. It will rotate through them if one fails.
 * This is suitable for development, but for production, a dedicated backend
 * proxy is recommended for reliability and security.
 *
 * @param countryCode The two-letter country code for the App Store region (e.g., 'us').
 * @param appId The ID of the app (e.g., 'id123456789').
 * @returns A promise that resolves with an array of in-app purchase products.
 */
export const getProducts: GetProductsFn = async (countryCode, appId) => {
  const targetUrl = `https://apps.apple.com/${countryCode}/app/${appId}`;
  const encodedTargetUrl = encodeURIComponent(targetUrl);

  for (const proxy of PROXY_URLS) {
    const proxyUrl = `${proxy}${encodedTargetUrl}`;
    try {
      // Fetch the data through the current proxy with an increased timeout.
      const response = await axios.get<string>(proxyUrl, { timeout: 5000 });
      const html = response.data;

      // Parse the HTML string into a DOM document.
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const products: Products = []; // Assuming 'Products' is a type like { product: string, cost: string }[]

      // [START] New logic to scrape 'text-pair' classes

      // Find all elements that have the 'text-pair' class.
      // This will match <div class="text-pair svelte-1a9curd"> and similar.
      const textPairElements = doc.querySelectorAll('.text-pair');

      // Iterate over each found 'text-pair' element
      textPairElements.forEach(pairElement => {
        // Find all <span> elements within this 'text-pair' element
        const spanElements = pairElement.querySelectorAll('span');

        // Check if we found at least two <span> elements
        if (spanElements.length >= 2) {
          // The first span is the product
          const productElement = spanElements[0];
          // The second span is the cost
          const costElement = spanElements[1];

          // Extract the text content and trim whitespace
          const product = productElement.textContent?.trim() || '';
          const cost = costElement.textContent?.trim() || '';

          // If both product and cost are non-empty, add to the array
          if (product && cost) {
            products.push({ product, cost });
          }
        }
      });
      return products;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(
          `Proxy ${proxy} failed for ${targetUrl}:`,
          error.message
        );
      } else {
        console.warn(`Proxy ${proxy} failed for ${targetUrl}:`, error);
      }
      // If a proxy fails (e.g., 429, timeout, CORS error), the loop will continue to the next one.
    }
  }

  console.error(`All proxies failed for ${targetUrl}. Unable to fetch data.`);
  return []; // Return empty array if all proxies fail.
};
