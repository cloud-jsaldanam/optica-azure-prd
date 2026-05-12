output "endpoint" { value = azurerm_cosmosdb_account.db_account.endpoint }
output "primary_key" { 
  value     = azurerm_cosmosdb_account.db_account.primary_key 
  sensitive = true
}