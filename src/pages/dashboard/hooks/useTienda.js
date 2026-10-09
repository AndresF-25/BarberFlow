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

  // Un solo PATCH: si cambia el stock, el servidor lo registra como corrección en el historial
  // calculando la diferencia sobre el stock real (no sobre el que la pantalla tenía en memoria).
  const editProducto = (id, data) => attempt(async () => {
    const { product } = await api.updateProduct(id, data);
    setProductos(prev => prev.map(p => p.id === id ? product : p));
  });

  // Entrada (+) o salida (−) de mercancía; queda en el historial con la razón «manual».
  const ajustarStock = (id, delta) => attempt(async () => {
    const { product } = await api.adjustProductStock(id, { delta, reason: 'manual' });
    setProductos(prev => prev.map(p => p.id === id ? product : p));
  });

  const removeProducto = (id) => attempt(async () => {
    await api.deleteProduct(id);
    setProductos(prev => prev.filter(p => p.id !== id));
  });

  // Movimientos de stock de un producto (los últimos). Devuelve { ok, movements, total }.
  const historialStock = (id) => attempt(async () => {
    const { movements, total } = await api.productStockHistory(id, { limit: 100 });
    return { movements, total };
  });

  // El servidor descuenta el stock y vincula al cliente; luego se recargan ambas listas.
  const addVenta = (data) => attempt(async () => {
    await api.createProductSale(data);
    await Promise.all([cargarProductos(), cargarVentas()]);
  });

  return { productos, ventas, productosEstado, ventasEstado, addProducto, editProducto, removeProducto, ajustarStock, historialStock, addVenta };
}
