
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Helper function to parse a string containing a number with various international separators.
 * This function uses explicit rules based on separator position and count.
 */
function parseNumberWithSeparators(price: string): number {
  const cleanString = price.replace(/[^\d.,]/g, '');
  if (!cleanString) return NaN;

  const lastDot = cleanString.lastIndexOf('.');
  const lastComma = cleanString.lastIndexOf(',');
  
  // Case 1: No separators or only one type of separator exists.
  if (lastDot === -1 || lastComma === -1) {
    const separator = lastDot > -1 ? '.' : ',';
    const parts = cleanString.split(separator);

    // If there are multiple separators of the same type (e.g., 1.000.000), they must be for thousands.
    if (parts.length > 2) {
      return parseFloat(cleanString.replace(new RegExp(`\\${separator}`, 'g'), ''));
    }

    // If there is a single separator (e.g., 539,99 or 49.000).
    if (parts.length === 2) {
      const integerPart = parts[0];
      const fractionalPart = parts[1];
      
      // Heuristic: If the part after the separator has 3 digits and the part before is not empty,
      // it is a thousands separator (e.g., "49.000" becomes 49000).
      if (fractionalPart.length === 3 && integerPart.length > 0) {
        return parseFloat(integerPart + fractionalPart);
      }
      
      // Otherwise, it's a decimal separator (e.g., "539,99" becomes 539.99).
      if (separator === ',') {
        return parseFloat(integerPart + '.' + fractionalPart);
      }
      return parseFloat(cleanString);
    }
    
    // If there is no separator, parse directly.
    return parseFloat(cleanString);
  }

  // Case 2: Both separators are present (e.g., 1,234.56 or 1.234,56).
  if (lastDot > lastComma) {
    // Dot is decimal, comma is thousands.
    return parseFloat(cleanString.replace(/,/g, ''));
  } else {
    // Comma is decimal, dot is thousands.
    return parseFloat(cleanString.replace(/\./g, '').replace(',', '.'));
  }
}


/**
 * Normalizes a price string into a number, handling various international formats.
 * e.g., "R5,399.99" -> 5399.99, "€5.399,99" -> 5399.99, "45.000đ" -> 45000, "Rp 75ribu" -> 75000
 */
export const normalizePrice = (price: string): number => {
    const priceLower = price.toLowerCase();

    // Custom parser for Indonesian 'juta' and 'ribu' which use comma as decimal
    const handleIndonesian = (keyword: string): number | null => {
        if (priceLower.includes(keyword)) {
            const numericPart = priceLower.split(keyword)[0];
            // In this context, comma is always a decimal. Remove thousands separators (dots) and replace comma.
            const numberString = numericPart.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, '');
            const baseNumber = parseFloat(numberString);
            if (!isNaN(baseNumber)) {
                const multiplier = keyword === 'juta' ? 1000000 : 1000;
                return baseNumber * multiplier;
            }
        }
        return null;
    };

    const jutaResult = handleIndonesian('juta');
    if (jutaResult !== null) return jutaResult;

    const ribuResult = handleIndonesian('ribu');
    if (ribuResult !== null) return ribuResult;

    return parseNumberWithSeparators(price);
};
