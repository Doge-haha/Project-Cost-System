import { randomUUID } from "node:crypto";

import { desc, eq } from "drizzle-orm";

import type { ApiDatabase } from "../../infrastructure/database/database-client.js";
import { processDocuments } from "../../infrastructure/database/schema.js";

export type ProcessDocumentType =
  | "change_order"
  | "site_visa"
  | "progress_payment";

export type ProcessDocumentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "settled";

export type ProcessDocumentRecord = {
  id: string;
  projectId: string;
  stageCode: string;
  disciplineCode: string;
  documentType: ProcessDocumentType;
  status: ProcessDocumentStatus;
  title: string;
  referenceNo: string;
  amount: number;
  submittedBy: string;
  submittedAt: string;
  lastComment?: string | null;
};

export interface ProcessDocumentRepository {
  listByProjectId(projectId: string): Promise<ProcessDocumentRecord[]>;
  findById(documentId: string): Promise<ProcessDocumentRecord | null>;
  create(
    input: Omit<ProcessDocumentRecord, "id">,
  ): Promise<ProcessDocumentRecord>;
  update(
    documentId: string,
    input: Pick<
      ProcessDocumentRecord,
      "title" | "referenceNo" | "amount" | "lastComment"
    >,
  ): Promise<ProcessDocumentRecord>;
  updateStatus(input: {
    documentId: string;
    status: ProcessDocumentStatus;
    lastComment?: string | null;
  }): Promise<ProcessDocumentRecord>;
  delete(documentId: string): Promise<void>;
}

export class InMemoryProcessDocumentRepository
  implements ProcessDocumentRepository
{
  private readonly documents: ProcessDocumentRecord[];

  constructor(seed: ProcessDocumentRecord[]) {
    this.documents = seed.map((document) => ({ ...document }));
  }

  async listByProjectId(projectId: string): Promise<ProcessDocumentRecord[]> {
    return this.documents
      .filter((document) => document.projectId === projectId)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt));
  }

  async findById(documentId: string): Promise<ProcessDocumentRecord | null> {
    return (
      this.documents.find((document) => document.id === documentId) ?? null
    );
  }

  async create(
    input: Omit<ProcessDocumentRecord, "id">,
  ): Promise<ProcessDocumentRecord> {
    const created: ProcessDocumentRecord = {
      id: `process-document-${String(this.documents.length + 1).padStart(3, "0")}`,
      ...input,
    };
    this.documents.push(created);
    return created;
  }

  async update(
    documentId: string,
    input: Pick<
      ProcessDocumentRecord,
      "title" | "referenceNo" | "amount" | "lastComment"
    >,
  ): Promise<ProcessDocumentRecord> {
    const target = this.documents.find((document) => document.id === documentId);
    if (!target) {
      throw new Error("Process document not found");
    }

    target.title = input.title;
    target.referenceNo = input.referenceNo;
    target.amount = input.amount;
    target.lastComment = input.lastComment;
    return target;
  }

  async updateStatus(input: {
    documentId: string;
    status: ProcessDocumentStatus;
    lastComment?: string | null;
  }): Promise<ProcessDocumentRecord> {
    const target = this.documents.find(
      (document) => document.id === input.documentId,
    );
    if (!target) {
      throw new Error("Process document not found");
    }

    target.status = input.status;
    target.lastComment = input.lastComment ?? null;
    return target;
  }

  async delete(documentId: string): Promise<void> {
    const index = this.documents.findIndex((document) => document.id === documentId);
    if (index === -1) {
      throw new Error("Process document not found");
    }

    this.documents.splice(index, 1);
  }
}

export class DbProcessDocumentRepository implements ProcessDocumentRepository {
  constructor(private readonly db: ApiDatabase) {}

  async listByProjectId(projectId: string): Promise<ProcessDocumentRecord[]> {
    const records = await this.db.query.processDocuments.findMany({
      where: (table, { eq: isEqual }) => isEqual(table.projectId, projectId),
      orderBy: (table, { desc: descending }) => [
        descending(table.submittedAt),
        descending(table.id),
      ],
    });

    return records.map(mapProcessDocumentRecord);
  }

  async findById(documentId: string): Promise<ProcessDocumentRecord | null> {
    const record = await this.db.query.processDocuments.findFirst({
      where: (table, { eq: isEqual }) => isEqual(table.id, documentId),
    });

    return record ? mapProcessDocumentRecord(record) : null;
  }

  async create(
    input: Omit<ProcessDocumentRecord, "id">,
  ): Promise<ProcessDocumentRecord> {
    const [created] = await this.db
      .insert(processDocuments)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        stageCode: input.stageCode,
        disciplineCode: input.disciplineCode,
        documentType: input.documentType,
        status: input.status,
        title: input.title,
        referenceNo: input.referenceNo,
        amount: input.amount,
        submittedBy: input.submittedBy,
        submittedAt: new Date(input.submittedAt),
        lastComment: input.lastComment ?? null,
      })
      .returning();

    return mapProcessDocumentRecord(created);
  }

  async update(
    documentId: string,
    input: Pick<
      ProcessDocumentRecord,
      "title" | "referenceNo" | "amount" | "lastComment"
    >,
  ): Promise<ProcessDocumentRecord> {
    const [updated] = await this.db
      .update(processDocuments)
      .set({
        title: input.title,
        referenceNo: input.referenceNo,
        amount: input.amount,
        lastComment: input.lastComment ?? null,
      })
      .where(eq(processDocuments.id, documentId))
      .returning();

    if (!updated) {
      throw new Error("Process document not found");
    }

    return mapProcessDocumentRecord(updated);
  }

  async updateStatus(input: {
    documentId: string;
    status: ProcessDocumentStatus;
    lastComment?: string | null;
  }): Promise<ProcessDocumentRecord> {
    const [updated] = await this.db
      .update(processDocuments)
      .set({
        status: input.status,
        lastComment: input.lastComment ?? null,
      })
      .where(eq(processDocuments.id, input.documentId))
      .returning();

    if (!updated) {
      throw new Error("Process document not found");
    }

    return mapProcessDocumentRecord(updated);
  }

  async delete(documentId: string): Promise<void> {
    const [deleted] = await this.db
      .delete(processDocuments)
      .where(eq(processDocuments.id, documentId))
      .returning({ id: processDocuments.id });

    if (!deleted) {
      throw new Error("Process document not found");
    }
  }
}

function mapProcessDocumentRecord(
  record: typeof processDocuments.$inferSelect,
): ProcessDocumentRecord {
  return {
    id: record.id,
    projectId: record.projectId,
    stageCode: record.stageCode,
    disciplineCode: record.disciplineCode,
    documentType: record.documentType as ProcessDocumentRecord["documentType"],
    status: record.status as ProcessDocumentRecord["status"],
    title: record.title,
    referenceNo: record.referenceNo,
    amount: record.amount,
    submittedBy: record.submittedBy,
    submittedAt: record.submittedAt.toISOString(),
    lastComment: record.lastComment ?? null,
  };
}
