import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getSeo, pageTitle, canonicalUrl, SEO } from '../data/seo';

const setMeta = (attr, key, content) => {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const setCanonical = (href) => {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
};

// Keeps title, description, keywords, canonical and social tags in sync with the route.
// The build also bakes the same tags into one HTML file per route (vite-plugin-seo.js),
// so crawlers that don't run JavaScript see them too.
const Seo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = SEO[pathname] ? pathname : '/';
    const seo = getSeo(path);
    const title = pageTitle(seo);
    const url = canonicalUrl(path);

    document.title = title;
    setMeta('name', 'description', seo.description);
    setMeta('name', 'keywords', seo.keywords.join(', '));
    setCanonical(url);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', seo.description);
    setMeta('property', 'og:url', url);
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', seo.description);
  }, [pathname]);

  return null;
};

export default Seo;
