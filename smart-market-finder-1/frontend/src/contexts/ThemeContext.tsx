import React, { createContext, useContext, useEffect } from 'react';

type ThemeContextValue = {
    setPageHero: (v: boolean) => void;
    setThemeDark: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Expose setters that add/remove classes on documentElement.
    useEffect(() => {
        return () => {
            // cleanup on full unmount: ensure classes removed
            try {
                document.documentElement.classList.remove('theme-dark');
                document.documentElement.classList.remove('page-hero');
            } catch (e) {}
        };
    }, []);

    const setPageHero = (v: boolean) => {
        try {
            if (v) document.documentElement.classList.add('page-hero');
            else document.documentElement.classList.remove('page-hero');
        } catch (e) {
            /* ignore in non-DOM env */
        }
    };

    const setThemeDark = (v: boolean) => {
        try {
            if (v) document.documentElement.classList.add('theme-dark');
            else document.documentElement.classList.remove('theme-dark');
        } catch (e) {
            /* ignore */
        }
    };

    return (
        <ThemeContext.Provider value={{ setPageHero, setThemeDark }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;
