"use server";

// Cotización del dólar oficial (Banco Nación, valor vendedor) vía dolarapi.com
// — es la referencia pública de uso más común para reemplazar al BNA, que no
// tiene API propia. Se llama desde el servidor para evitar problemas de CORS
// y para no depender de que el navegador del vendedor pueda alcanzar el sitio.
export async function getUsdArsRate() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial", {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        ok: false as const,
        error: "No se pudo obtener la cotización del dólar.",
      };
    }

    const data = await res.json();
    const venta = Number(data?.venta);

    if (!Number.isFinite(venta) || venta <= 0) {
      return {
        ok: false as const,
        error: "La cotización recibida no es válida.",
      };
    }

    return { ok: true as const, venta };
  } catch {
    return {
      ok: false as const,
      error: "Error de red al consultar la cotización del dólar.",
    };
  }
}
