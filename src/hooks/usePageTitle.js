import { useEffect } from 'react';

// Overrides the route's SEO title (set by components/Seo.jsx) with a runtime one,
// e.g. the file pair a compare tab was opened for. Does nothing when title is empty.
const usePageTitle = (title) => {
  useEffect(() => {
    if (title) document.title = `${title} | DevTools Open Source`;
  }, [title]);
};

export default usePageTitle;
