import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { attempt } from './attempt';

/* Inventario y ventas de productos (contra la API). Cada acción devuelve { ok, error }. */
export function useTienda() {
  const [productos, setProductos] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [productosEstado, setProductosEstado] = useState({ loading: true, error: '' });
  const [ventasEstado, setVentasEstado] = useState({ loading: true, error: '' });

  const cargarProductos = async () => {
    try {
      const { products } = await api.listProducts();
      setProductos(products || []);
      setProductosEstado({ loading: false, error: '' });
    } catch (err) {
      setProductosEstado({ loading: false, error: err.message });
    }
  };

  const cargarVentas = async () => {
    try {
      const { ventas: lista } = await api.listProductSales();
      setVentas(lista || []);
      setVentasEstado({ loading: false, error: '' });
    } catch (err) {
      setVentasEstado({ loading: false, error: err.message });
    }
  };

  useEffect(() => { cargarProductos(); cargarVentas(); }, []);

  const addProducto = (data) => attempt(async () => {
    const { product } = await api.createProduct(data);
    setProductos(prev => [...prev, product]);
  });

  // El stock se corrige con un ajuste (queda en el historial de stock), no con un PATCH directo.
  const editProducto = (id, data) => attempt(async () => {
    const actual = productos.find(p => p.id === id);
    const { stock, ...resto } = data;
    let { product } = await api.updateProduct(id, resto);
    if (actual && stock !== actual.stock) {
      ({ product } = await api.adjustProductStock(id, { delta: stock - actual.stock, reason: 'correction' }));
    }
    setProductos(prev => prev.map(p => p.id === id ? product : p));
  });

  const removeProducto = (id) => attempt(async () => {
    await api.deleteProduct(id);
    setProductos(prev => prev.filter(p => p.id !== id));
  });

  // El servidor descuenta el stock y vincula al cliente; luego se recargan ambas listas.
  const addVenta = (data) => attempt(async () => {
    await api.createProductSale(data);
    await Promise.all([cargarProductos(), cargarVentas()]);
  });

  return { productos, ventas, productosEstado, ventasEstado, addProducto, editProducto, removeProducto, addVenta };
}
