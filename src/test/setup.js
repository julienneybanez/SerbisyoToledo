import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
	cleanup();
});

const createStorage = () => {
	const values = new Map();
	return {
		get length() { return values.size; },
		key: (index) => Array.from(values.keys())[index] || null,
		getItem: (key) => values.has(String(key)) ? values.get(String(key)) : null,
		setItem: (key, value) => values.set(String(key), String(value)),
		removeItem: (key) => values.delete(String(key)),
		clear: () => values.clear(),
	};
};

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: createStorage() });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: createStorage() });
