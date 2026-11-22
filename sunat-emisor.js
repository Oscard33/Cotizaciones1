const SUNAT_API_URL = "https://TU-SERVICIO.onrender.com/index.php"; // Reemplaza con tu URL del backend

async function emitirComprobanteDesdeCotizacion(cotizacion, preciosIncluyenIgv = true) {
  const numDoc = String(cotizacion.cliente?.doc || "").trim();
  const esFactura = numDoc.length === 11; // 11 dígitos = RUC (Factura 01), 8 dígitos = DNI (Boleta 03)
  const tipoDocSunat = esFactura ? "01" : "03";
  const serie = esFactura ? "F001" : "B001";

  const claveCorrelativo = `correlativo_${serie}`;
  const correlativo = (Number(localStorage.getItem(claveCorrelativo)) || 0) + 1;

  let gravadaTotal = 0;
  let igvTotal = 0;

  const itemsFormateados = (cotizacion.items || []).map((item, idx) => {
    const cantidad = Number(item.cantidad) || 1;
    const precioRef = Number(item.precio) || 0;

    const valorUnitario = preciosIncluyenIgv ? (precioRef / 1.18) : precioRef;
    const precioUnitario = preciosIncluyenIgv ? precioRef : (precioRef * 1.18);

    const valorVenta = Number((valorUnitario * cantidad).toFixed(2));
    const igvItem = Number((valorVenta * 0.18).toFixed(2));

    gravadaTotal = Number((gravadaTotal + valorVenta).toFixed(2));
    igvTotal = Number((igvTotal + igvItem).toFixed(2));

    return {
      codigo: item.codigo || `PROD-${idx + 1}`,
      unidad: item.unidad || "NIU",
      cantidad,
      descripcion: item.descripcion || "Producto",
      valorUnitario: Number(valorUnitario.toFixed(6)),
      precioUnitario: Number(precioUnitario.toFixed(6)),
      valorVenta,
      igv: igvItem
    };
  });

  const payload = {
    tipoDoc: tipoDocSunat,
    serie,
    correlativo: String(correlativo),
    moneda: cotizacion.moneda || "PEN",
    gravada: gravadaTotal,
    igv: igvTotal,
    total: Number((gravadaTotal + igvTotal).toFixed(2)),
    cliente: {
      tipoDoc: esFactura ? "6" : "1",
      numDoc,
      razonSocial: cotizacion.cliente?.nombre || "CLIENTE VARIOS"
    },
    items: itemsFormateados
  };

  const resp = await fetch(SUNAT_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`Error ${resp.status} al conectar con el servicio SUNAT`);
  }

  const data = await resp.json();
  if (data.exito) {
    localStorage.setItem(claveCorrelativo, String(correlativo));
  }
  return { ...data, serie, correlativo };
}
