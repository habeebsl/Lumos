import axios from 'axios';
import * as cheerio from 'cheerio';

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export async function searchGoogle(query: string): Promise<SearchResult[]> {
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const results: SearchResult[] = [];

    // Extract search result snippets
    $('.g').each((_, element) => {
      const title = $(element).find('h3').text();
      const snippet = $(element).find('.VwiC3b').text();
      const url = $(element).find('a').attr('href') || '';
      
      if (title && snippet) {
        results.push({ title, snippet, url });
      }
    });

    return results.slice(0, 3);
  } catch (error) {
    console.error('Google search failed:', error);
    return [];
  }
}

export async function searchGoogleImages(query: string, count: number = 1): Promise<string[]> {
  try {
    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      console.error('SERPAPI_KEY not found');
      return fallbackImages(query, count);
    }

    const searchUrl = `https://serpapi.com/search.json?engine=google_images&q=${encodeURIComponent(query)}&num=${count}&api_key=${apiKey}`;
    const response = await axios.get(searchUrl);

    const imageUrls: string[] = [];
    
    // Extract original image URLs from results
    if (response.data.images_results) {
      for (const result of response.data.images_results.slice(0, count)) {
        // Prefer original > thumbnail
        const imageUrl = result.original || result.thumbnail;
        if (imageUrl) {
          imageUrls.push(imageUrl);
        }
      }
    }

    // Fallback if no images found
    if (imageUrls.length === 0) {
      return fallbackImages(query, count);
    }

    return imageUrls;
  } catch (error) {
    console.error('SerpAPI image search failed:', error);
    return fallbackImages(query, count);
  }
}

function fallbackImages(query: string, count: number): string[] {
  const imageUrls: string[] = [];
  for (let i = 0; i < count; i++) {
    const seed = Math.random().toString(36).substring(7);
    imageUrls.push(`https://source.unsplash.com/800x600/?${encodeURIComponent(query)}&sig=${seed}`);
  }
  return imageUrls;
}

export async function fetchMultipleImages(queries: string[]): Promise<string[]> {
  // Fetch all images in parallel for speed
  const imagePromises = queries.map(query => searchGoogleImages(query, 1));
  const results = await Promise.all(imagePromises);
  return results.map(urls => urls[0] || 'https://source.unsplash.com/800x600/?education');
}
