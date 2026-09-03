import { currentLocale, type Locale } from './index';
import type { MenuVO } from '@/types/api';

// Keyed primarily by routePath (leaf menus); directory nodes without a
// routePath are keyed by their Chinese `name`. Unmapped => raw DB name.
const menuMap: Record<Locale, Record<string, string>> = {
  'zh-CN': {},
  'en-US': {
    系统管理: 'System',
    基础数据: 'Base Data',
    平台目录: 'Catalog',
    商品管理: 'Product',
    采购管理: 'Purchasing',
    库存管理: 'Inventory',
    销售管理: 'Sales',
    物流管理: 'Logistics',
    客户管理: 'Customers',
    广告管理: 'Advertising',
    '/dashboard': 'Dashboard',
    '/system/user': 'Users',
    '/system/role': 'Roles',
    '/system/menu': 'Menus',
    '/basedata/brand': 'Brands',
    '/basedata/category': 'Categories',
    '/basedata/supplier': 'Suppliers',
    '/basedata/logistics-provider': 'Logistics Providers',
    '/product/spu': 'SPU',
    '/product/sku': 'SKU',
    '/product/supplier-product': 'Supplier Products',
    '/purchase/plan': 'Purchase Plans',
    '/purchase/order': 'Purchase Orders',
    '/inventory/stock': 'Stock',
    '/sales/order': 'Sales Orders',
    '/logistics/track': 'Logistics Tracking',
    '/customer': 'Customers',
    '/ad/image-generation': 'AI Images',
    '/ad/model': 'AI Models',
  },
};

export function menuLabel(node: Pick<MenuVO, 'routePath' | 'name'>): string {
  const map = menuMap[currentLocale.value];
  return (node.routePath && map[node.routePath]) || map[node.name] || node.name;
}
