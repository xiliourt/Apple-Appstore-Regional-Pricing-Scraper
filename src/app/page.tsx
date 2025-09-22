'use client';

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useState, useTransition, useEffect, useMemo } from 'react';
import { getProducts } from '../lib/scraper';
import { countryData, apple_store_currency_map } from '../lib/constants';
import axios from 'axios';
import {
  ScrapedProduct,
  GroupedProduct,
  SortConfig,
  ExchangeRates,
  groupProducts,
  sortGroupedProducts
} from '../lib/utils';

export default function Home(): JSX.Element {
  const [appId, setAppId] = useState('6477489729'); // Default: Procreate
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // State for grouped data, selected product, and sorting
  const [groupedData, setGroupedData] = useState<Record<string, GroupedProduct[]>>({});
  const [selectedProduct, setSelectedProduct] = useState<string>('');
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: 'convertedCost',
    direction: 'ascending',
  });

  // State for currency conversion
  const [conversionCurrency, setConversionCurrency] = useState<string | null>(null);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({});
  const [ratesError, setRatesError] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);

  // Derive available currencies for the dropdown from countryData

  // Effect to fetch exchange rates when data or selected currency changes
  useEffect(() => {
    const fetchRates = async () => {
        if (!conversionCurrency || Object.keys(groupedData).length === 0) {
            return;
        }

        setLoadingRates(true);
        setRatesError(null);

        const allProducts = Object.values(groupedData).flat();
        const sourceCurrencies = [...new Set(allProducts.map(p => p.currency))];
        const currenciesToFetch = sourceCurrencies.filter(
          c => !exchangeRates[c] && c !== conversionCurrency
        );

        if (currenciesToFetch.length === 0) {
            setLoadingRates(false);
            return;
        }

        try {
            const ratePromises = currenciesToFetch.map(baseCurrency =>
                axios.get(`https://open.er-api.com/v6/latest/${baseCurrency}`)
            );
            const responses = await Promise.all(ratePromises);
            const newRates: Record<string, Record<string, number>> = {};
            responses.forEach((response, index) => {
                const baseCurrency = currenciesToFetch[index];
                if (response.data && response.data.rates) {
                    newRates[baseCurrency] = response.data.rates;
                }
            });
            setExchangeRates(prevRates => ({ ...prevRates, ...newRates }));
        } catch (err) {
            console.error('Failed to fetch exchange rates:', err);
            setRatesError('Could not fetch exchange rates.');
        } finally {
            setLoadingRates(false);
        }
    };

    fetchRates();
  }, [groupedData, conversionCurrency, exchangeRates]);

  const handleSearch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const searchAppId = (formData.get('appId') as string)?.trim();
    if (!searchAppId) {
      setError('Please enter an App ID.');
      return;
    }

    startTransition(() => {
        setLoading(true);
        setError(null);
        setProgress(0);
        setGroupedData({});
        setSelectedProduct('');
        setSortConfig({ key: 'convertedCost', direction: 'ascending' });
        setExchangeRates({});
        setRatesError(null);
    });

    const allProducts: ScrapedProduct[] = [];
    const promises = Object.entries(countryData).map(async ([countryCode, countryName]) => {
      try {
        const products = await getProducts(countryCode, searchAppId);
        products.forEach(p => {
          allProducts.push({
            ...p,
            countryCode: countryCode, 
            countryName: countryName, 
            currency: apple_store_currency_map[countryCode],
          });
        });
      } catch (err) {
        console.error(`Failed to fetch for ${countryName}`, err);
      } finally {
        startTransition(() => {
          setProgress(prev => prev + 1);
        });
      }
    });

    startTransition(() => {
      const finalGroupedData = groupProducts(allProducts);
      const productNames = Object.keys(finalGroupedData).sort();

      setGroupedData(finalGroupedData);
      if (productNames.length > 0) {
        setSelectedProduct(productNames[0]);
      }
      setLoading(false);
    });
  };

  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortClass = (name: string) => {
    if (sortConfig.key !== name) {
      return 'sortable';
    }
    return `sortable sorted-${sortConfig.direction}`;
  };

  const sortedTableData = useMemo(() => {
    if (!selectedProduct || !groupedData[selectedProduct]) {
        return [];
    }
    return sortGroupedProducts(
        groupedData[selectedProduct],
        sortConfig,
        conversionCurrency,
        exchangeRates
    );
  }, [selectedProduct, groupedData, sortConfig, conversionCurrency, exchangeRates]);


  return (
    <main>
      <h1>App Store Price Scraper</h1>
      <div className="controls-container">
        <form className="search-form" onSubmit={handleSearch}>
          <input
            type="text"
            name="appId"
            defaultValue={appId}
            placeholder="Enter Apple App ID (e.g., 414200095)"
            aria-label="Apple App ID"
            required
          />
          <button type="submit" disabled={loading || isPending}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        <div className="currency-converter">
          <label htmlFor="conversion-currency">Convert to:</label>
          <select
            id="conversion-currency"
            value={conversionCurrency || ''}
            onChange={(e) => setConversionCurrency(e.target.value || null)}
            disabled={loading || isPending}
            aria-label="Select conversion currency"
          >
            <option value="">-- Select Currency --</option>
            {availableCurrencies.map(currency => (
              <option key={currency} value={currency}>{currency}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && (
        <div className="loading-container" role="status" aria-live="polite">
          <p>Scraping data for {countryData.length} countries...</p>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{ width: `${(progress / countryData.length) * 100}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={countryData.length}
            ></div>
          </div>
          <p>{progress} / {countryData.length} countries processed.</p>
        </div>
      )}

      {!loading && Object.keys(groupedData).length > 0 && (
        <div className="results-container">
          <div className="product-selector">
            <label htmlFor="product-select">Displaying prices for:</label>
            <select
              id="product-select"
              value={selectedProduct}
              onChange={e => setSelectedProduct(e.target.value)}
              aria-label="Select a product to view its prices"
            >
              {Object.keys(groupedData).sort().map(productName => (
                <option key={productName} value={productName}>{productName}</option>
              ))}
            </select>
          </div>
          <table>
            <thead>
              <tr>
                <th className={getSortClass('currency')} onClick={() => requestSort('currency')}>Currency</th>
                <th className={getSortClass('cost')} onClick={() => requestSort('cost')}>Original Cost</th>
                <th className={getSortClass('convertedCost')} onClick={() => requestSort('convertedCost')}>Converted Cost</th>
                <th className={getSortClass('countries')} onClick={() => requestSort('countries')}>Countries</th>
              </tr>
            </thead>
            <tbody>
              {sortedTableData.map((item, index) => (
                <tr key={`${item.currency}-${item.cost}-${index}`}>
                  <td>{item.currency}</td>
                  <td>{item.cost.toFixed(2)}</td>
                  <td>
                    {(() => {
                        if (!conversionCurrency) return <span className="subtle-text">--</span>;

                        if (item.currency === conversionCurrency) {
                            return `${item.cost.toFixed(2)} ${conversionCurrency}`;
                        }
                        
                        const rate = exchangeRates[item.currency]?.[conversionCurrency];

                        if (loadingRates && !rate) return '...';
                        if (ratesError && !rate) return <span className="error-text">Error</span>;

                        if (rate) {
                            const convertedCost = item.cost * rate;
                            return `${convertedCost.toFixed(2)} ${conversionCurrency}`;
                        }
                        return '...';
                    })()}
                  </td>
                  <td>{[...item.countries].sort().join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
