import { useEffect } from 'react';

const usePageTitle = (title) => {
  useEffect(() => {
    document.title = `${title} | DevTools Open Source`;
  }, [title]);
};

export default usePageTitle;
