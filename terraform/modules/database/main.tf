resource "azurerm_cosmosdb_account" "db_account" {
  name                = var.account_name
  location            = var.location
  resource_group_name = var.rg_name
  offer_type          = "Standard"
  kind                = "GlobalDocumentDB"

  # ACTIVACIÓN ESTRICTA DEL MODO SERVERLESS PARA COSTO MÍNIMO
  capabilities {
    name = "EnableServerless"
  }

  consistency_policy {
    consistency_level = "Session"
  }

  geo_location {
    location          = var.location
    failover_priority = 0
  }
}

resource "azurerm_cosmosdb_sql_database" "db" {
  name                = "OpticaDB"
  resource_group_name = var.rg_name
  account_name        = azurerm_cosmosdb_account.db_account.name
}

resource "azurerm_cosmosdb_sql_container" "container" {
  name                = "Registros"
  resource_group_name = var.rg_name
  account_name        = azurerm_cosmosdb_account.db_account.name
  database_name       = azurerm_cosmosdb_sql_database.db.name
  
  # Propiedad oficial y moderna en plural pasándole la lista de rutas
  partition_key_paths = ["/tipo"]
}