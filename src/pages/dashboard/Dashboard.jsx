import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, todayIso } from '../../api/client';
import { C } from './theme';
import { fmtFechaLarga } from './dates';
import { NAV, NAV_BY_ROLE, ROLE_LABEL, NAV_TIENDA, NAV_TIENDA_BY_ROLE, TITLES } from './navigation';
import { attempt } from './hooks/attempt';
import { useServicios } from './hooks/useServicios';
import { useTienda } from './hooks/useTienda';
import { useEmpleados } from './hooks/useEmpleados';
import { GlobalStyles } from './components/GlobalStyles';
import { TopNav, PageHead } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { CitaModal } from './views/CitaModal';
import { AgendaView } from './views/AgendaView';
import { ClientesView } from './views/ClientesView';
import { ServiciosView } from './views/ServiciosView';
import { IngresosView } from './views/IngresosView';
import { MetricasView } from './views/MetricasView';
import { AlertasView } from './views/AlertasView';
import { InventarioView } from './views/InventarioView';
import { VentasView } from './views/VentasView';
import { EmpleadosView } from './views/EmpleadosView';
import { NegocioView } from './views/NegocioView';

export default function Dashboard() {
  const { user, business, updateBusiness, logout } = useAuth();
  const role = user?.role === 'employee' ? 'employee' : 'owner'; // fallback defensivo
  const [active, setActive] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [citasVersion, setCitasVersion] = useState(0); // se incrementa para recargar las citas desde la API
  const bumpCitas = () => setCitasVersion(v => v + 1);

  const catalogo = useServicios();
  const tienda = useTienda();
  const equipo = useEmpleados();

  // El nombre del negocio identifica la pestaña del navegador.
  useEffect(() => {
    document.title = business?.name ? `${business.name} · BarberFlow` : 'BarberFlow';
  }, [business?.name]);

  const [title, baseSubtitle] = TITLES[active];
  const subtitle = active === 'dashboard' ? `${baseSubtitle}, hoy ${fmtFechaLarga(todayIso())}` : baseSubtitle;

  // Menú filtrado según el rol: RoleRoute ya garantizó que solo owner/employee
  // llegan hasta acá, así que alcanza con distinguir esos dos casos.
  const allowedIds = NAV_BY_ROLE[role] || NAV_BY_ROLE.employee;
  const navItems = NAV.filter(item => allowedIds.includes(item.id));
  const allowedTiendaIds = NAV_TIENDA_BY_ROLE[role] || [];
  const navTienda = NAV_TIENDA.filter(item => allowedTiendaIds.includes(item.id));

  // El modal de nueva cita vive acá (no dentro de AgendaView) para que el
  // botón "Nueva cita" del Topbar funcione sin importar el menú activo.
  const handleGuardarCita = (data) => attempt(async () => {
    await api.createAppointment(data);
    bumpCitas();
  });

  return (
    <div className="bd-root min-h-screen w-full" style={{ background: C.bg }}>
      <GlobalStyles />
      {showModal && (
        <CitaModal
          servicios={catalogo.servicios}
          empleados={equipo.empleados}
          esEmpleado={role === 'employee'}
          userId={user?.id}
          onClose={() => setShowModal(false)}
          onSave={handleGuardarCita}
        />
      )}
      <TopNav active={active} setActive={setActive} userName={user?.name} businessName={business?.name} roleLabel={ROLE_LABEL[role]}
        navItems={navItems} navTienda={navTienda} onLogout={logout} onNuevaCita={() => setShowModal(true)}
        onNegocio={role === 'owner' ? () => setActive('negocio') : undefined} />
      <main className="mx-auto max-w-[1280px] px-5 lg:px-8 pb-20">
        <PageHead title={title} subtitle={subtitle} />
        {active === 'dashboard' && <DashboardView servicios={catalogo.servicios} citasVersion={citasVersion} esOwner={role === 'owner'} />}
        {active === 'agenda' && <AgendaView citasVersion={citasVersion} onChanged={bumpCitas} />}
        {active === 'clientes' && <ClientesView esOwner={role === 'owner'} />}
        {active === 'servicios' && (
          <ServiciosView servicios={catalogo.servicios} estado={catalogo.estado} onAdd={catalogo.add} onEdit={catalogo.edit} onDelete={catalogo.remove} readOnly={role !== 'owner'} />
        )}
        {active === 'empleados' && role === 'owner' && (
          <EmpleadosView equipo={equipo.equipo} onCreate={equipo.create} onUpdate={equipo.update} />
        )}
        {active === 'negocio' && role === 'owner' && <NegocioView business={business} onSave={updateBusiness} />}
        {active === 'ingresos' && role === 'owner' && <IngresosView />}
        {active === 'metricas' && role === 'owner' && <MetricasView />}
        {active === 'alertas' && role === 'owner' && <AlertasView onNavigate={setActive} />}
        {active === 'inventario' && role === 'owner' && (
          <InventarioView productos={tienda.productos} estado={tienda.productosEstado} onAdd={tienda.addProducto} onEdit={tienda.editProducto} onDelete={tienda.removeProducto} onAdjust={tienda.ajustarStock} onHistory={tienda.historialStock} />
        )}
        {active === 'ventas' && (
          <VentasView productos={tienda.productos} ventas={tienda.ventas} estado={tienda.ventasEstado} onAddVenta={tienda.addVenta} esOwner={role === 'owner'} />
        )}
      </main>
    </div>
  );
}
