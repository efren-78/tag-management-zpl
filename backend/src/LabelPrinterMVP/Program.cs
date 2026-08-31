using LabelPrinterMVP.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// ── CORS: Permitir solicitudes desde el frontend ──
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:3000", "http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();

// ── Registro modular de Endpoints ──
app.MapHealthEndpoints();
app.MapPrinterEndpoints();
app.MapZplEndpoints();

app.Run();
