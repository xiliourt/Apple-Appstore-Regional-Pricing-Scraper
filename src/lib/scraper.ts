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
  'https://api.allorigins.win/raw?url=',
  'https://crossorigin.me/'
  'https://api.allorigins.win/raw?url='
  'https://api.codetabs.com/v1/proxy/?quest='
  'http://www.whateverorigin.org/get?url='
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
      const response = await axios.get<string>(proxyUrl, { timeout: 15000 });
      const html = response.data;

      // Parse the HTML string into a DOM document.
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const products: Products = [];

      // Find the <dt> for "In-App Purchases".
      const inAppPurchasesDt = Array.from(
        doc.querySelectorAll('dt.information-list__item__term')
      ).find(dt => dt.textContent?.trim() === 'In-App Purchases');

      if (inAppPurchasesDt) {
        // The parent element should be a div that also contains the <dd>.
        const parentElement = inAppPurchasesDt.parentElement;
        if (parentElement) {
          // Find the corresponding <dd> element.
          const definitionElement = parentElement.querySelector(
            'dd.information-list__item__definition'
          );

          if (definitionElement) {
            // Find all list items representing in-app purchases.
            const productItems = definitionElement.querySelectorAll(
              'li.list-with-numbers__item'
            );

            productItems.forEach(item => {
              const productElement = item.querySelector(
                '.list-with-numbers__item__title span'
              );
              const costElement = item.querySelector(
                '.list-with-numbers__item__price'
              );

              if (productElement && costElement) {
                const product = productElement.textContent?.trim() || '';
                const cost = costElement.textContent?.trim() || '';

                if (product && cost) {
                  products.push({ product, cost });
                  return products;
                }
              }
            });
          }
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.warn(
          `Proxy ${proxy} failed for ${targetUrl}:`,
          error.message
        );
      } else {
        console.warn(`Proxy ${proxy} failed for ${targetUrl}:`, error);
      }
    }
  }

  console.error(`All proxies failed for ${targetUrl}. Unable to fetch data.`);
  return []; // Return empty array if all proxies fail.
};
