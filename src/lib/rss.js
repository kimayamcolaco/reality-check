// Your news sources with RSS feeds
export const NEWS_SOURCES = [
  {
    name: "Lenny's Newsletter",
    url: 'https://www.lennysnewsletter.com/feed',
    type: 'newsletter'
  },
  {
    name: 'Pivot Podcast',
    url: 'https://feeds.megaphone.fm/pivot',
    type: 'podcast'
  },
  {
    name: 'Morning Brew Daily',
    url: 'https://feeds.simplecast.com/76rUd4I6',
    type: 'podcast'
  },
  {
    name: 'BBC World News',
    url: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    type: 'news'
  },
  {
    name: 'Up First by NPR',
    url: 'https://feeds.npr.org/510318/podcast.xml',
    type: 'podcast'
  },
  {
    name: 'Reuters',
    url: 'https://feeds.reuters.com/reuters/topNews',
    type: 'news'
  },
  {
    name: 'New York Times',
    url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
    type: 'news'
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
    type: 'news'
  }
];

// Fetch RSS feed
async function fetchFeed(feedUrl) {
  try {
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(feedUrl)}`;
    const response = await fetch(proxyUrl);
    const xmlText = await response.text();
    
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, 'text/xml');
    
    const items = xml.querySelectorAll('item');
    const articles = [];
    
    items.forEach((item, index) => {
      if (index >= 3) return; // Only get 3 most recent per source
      
      const title = item.querySelector('title')?.textContent;
      const link = item.querySelector('link')?.textContent;
      const description = item.querySelector('description')?.textContent || 
                         item.querySelector('summary')?.textContent ||
                         item.querySelector('content\\:encoded')?.textContent;
      const pubDate = item.querySelector('pubDate')?.textContent;
      
      if (title) {
        // Clean HTML from description
        const cleanDesc = description ? 
          description.replace(/<[^>]*>/g, '').substring(0, 1000) : 
          title;
        
        articles.push({
          title: title.trim(),
          url: link?.trim() || '',
          content: cleanDesc.trim(),
          published_date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        });
      }
    });
    
    return articles;
    
  } catch (error) {
    console.error(`Error fetching feed ${feedUrl}:`, error);
    return [];
  }
}

// Fetch from all sources
export async function fetchAllSources() {
  const allArticles = [];
  
  for (const source of NEWS_SOURCES) {
    console.log(`Fetching ${source.name}...`);
    const articles = await fetchFeed(source.url);
    
    articles.forEach(article => {
      allArticles.push({
        ...article,
        source: source.name
      });
    });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return allArticles;
}
