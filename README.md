# MVP - Sistema de Gestión de Etiquetas Zebra

Este proyecto es un **Producto Mínimo Viable (MVP)** desarrollado en C# (.NET) para la generación y envío dinámico de etiquetas en lenguaje **ZPL** (Zebra Programming Language) hacia impresoras térmicas Zebra (compatible con modelos como Zebra 110xi4, ZT series, entre otros).

---

## 🚀 Características Principales

* **Operación 100% Offline (Sin Internet):** Todo el procesamiento ZPL se realiza de manera local en el equipo y la comunicación se realiza directamente mediante puerto USB o Red Local (LAN).
* **Impresión por USB:** Soporte de impresión directa a impresoras conectadas por USB en Windows a través del Spooler de impresión en modo **RAW** (`winspool.drv`). Incluye autodetección de impresoras instaladas en el sistema.
* **Impresión por Red (TCP/IP):** Envío directo de comandos ZPL vía sockets TCP (puerto predeterminado 9100) para impresoras conectadas a la red ethernet o Wi-Fi.
* **Generación Dinámica de ZPL:** Construcción automática de la plantilla ZPL incluyendo:
  * Nombre del producto
  * Fecha de generación
  * Código de barras en formato **Code 128**
  * Control del número de copias (`^PQ`)
  * Sanitización de caracteres de control ZPL (`^` y `~`)

---

## 📁 Estructura del Código

```text
LabelPrinterMVP/
├── Program.cs                # Consola interactiva para el usuario
├── ZplBuilder.cs             # Generador de código ZPL en memoria
├── LabelData.cs              # Modelo de datos de la etiqueta
├── ZebraPrinterClient.cs     # Cliente de comunicación por Red (TCP/IP socket)
└── ZebraUsbPrinterClient.cs  # Cliente de comunicación por USB (Windows Spooler RAW)
```

---

## 🛠️ Requisitos Previos

* **SDK de .NET 8.0** o superior (probado en .NET 10.0).
* **Sistema Operativo:** Windows (requerido para el módulo de impresión directa USB/Spooler).
* **Impresora Zebra** conectada por USB o IP, o bien un simulador ZPL en la red local.

---

## 💻 Instrucciones de Ejecución

1. Abrir la terminal en la carpeta del proyecto.
2. Compilar el proyecto:
   ```bash
   dotnet build LabelPrinterMVP
   ```
3. Ejecutar la aplicación:
   ```bash
   dotnet run --project LabelPrinterMVP
   ```

4. Sigue las instrucciones interactivas en consola:
   - Ingresa los datos del producto (Nombre, Código, Copias).
   - Revisa el código ZPL generado.
   - Selecciona el método de envío (**1. Red TCP/IP** o **2. USB**).
   - Confirma el envío a la impresora.

---

## 📄 Licencia y Uso
Desarrollado como MVP para soluciones de etiquetado industrial.
