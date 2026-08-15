export interface MenuItem {
  id: string;
  name: string;
  category: 'burgers' | 'rolls' | 'dogs' | 'appetizers' | 'sauces';
  price: number;
  description?: string;
  tags?: string[];
  iconType?: string;
  ingredients?: string[];
}

export interface CartItem {
  id: string; // unique cart instance id (item.id + custom options hash)
  menuItem: MenuItem;
  quantity: number;
  selectedSauces: string[];
  excludedIngredients: string[];
  extraPatty: boolean;
  extraCheese: boolean;
  notes: string;
  finalPrice: number;
}

export interface Order {
  id: string;
  items: CartItem[];
  customerName: string;
  phone: string;
  address: string;
  paymentMethod: 'crypto' | 'credits' | 'card_terminal';
  deliveryType: 'delivery' | 'pickup';
  totalAmount: number;
  timestamp: string;
  status: 'ordered' | 'preparing' | 'in_transit' | 'ready';
}
