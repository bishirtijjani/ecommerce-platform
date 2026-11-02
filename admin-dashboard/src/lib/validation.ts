export const isValidHex = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value);

export const validateEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const validateRequired = (value: string) => value.trim().length > 0;

export const validateMinLength = (value: string, min: number) => value.trim().length >= min;

export const validateMaxLength = (value: string, max: number) => value.length <= max;

export const isValidUrl = (value: string) => !value || /^https?:\/\/\S+$/.test(value);
