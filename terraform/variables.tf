variable "location" {
  type        = string
  default     = "eastus2"
  description = "Región principal de despliegue en Azure"
}

variable "prefix" {
  type        = string
  # ⚠️ REEMPLAZA ESTE VALOR (Opcional): Nombre corto para identificar tus recursos
  default     = "optica"
  description = "Prefijo para los recursos del sistema"
}