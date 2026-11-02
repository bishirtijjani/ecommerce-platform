import api from './client';
import type { VendorCategory } from '../types';

export const listCategories = () => api.get<unknown, { data: VendorCategory[] }>('/categories').then((r) => r.data);
