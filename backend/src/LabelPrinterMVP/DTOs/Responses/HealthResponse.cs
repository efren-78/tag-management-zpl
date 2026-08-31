namespace LabelPrinterMVP.DTOs.Responses;

/// <summary>
/// Respuesta del estado de salud del backend.
/// </summary>
public class HealthResponse
{
    public string Status { get; set; } = "ok";
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;

    public HealthResponse() { }

    public HealthResponse(string status, DateTime timestamp)
    {
        Status = status;
        Timestamp = timestamp;
    }
}
