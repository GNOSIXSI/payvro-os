import type {
  DataModelFromSchemaDefinition,
  DocumentByName,
  GenericId,
  SystemTableNames,
  TableNamesInDataModel,
} from "convex/server";
import type schema from "../schema.js";

export type DataModel = DataModelFromSchemaDefinition<typeof schema>;
export type TableNames = TableNamesInDataModel<DataModel>;
export type Doc<TableName extends TableNames> = DocumentByName<DataModel, TableName>;
export type Id<TableName extends TableNames | SystemTableNames> = GenericId<TableName>;
