import { Cormorant_Garamond, Inter } from 'next/font/google';

const heading = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-heading' });
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-body' });

/** Defines --font-heading and --font-body; put on <html> by the root layout and global-error. */
export const fontVariables = `${heading.variable} ${body.variable}`;
