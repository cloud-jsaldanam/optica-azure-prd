output "portal_url" {
  value       = "https://${module.frontend.default_hostname}"
  description = "URL pública de acceso a la plataforma"
}

output "aswa_deployment_token" {
  value       = module.frontend.api_key
  sensitive   = true
  description = "Token para configurar en los Secrets de GitHub Actions"
}

output "cosmos_endpoint" {
  value       = module.database.endpoint
  description = "Endpoint de la BD para inyectar en las variables de entorno"
}

output "cosmos_key" {
  value       = module.database.primary_key
  sensitive   = true
  description = "Clave primaria de la BD"
}