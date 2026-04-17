export type ProcessDocumentType =
  | "change_order"
  | "site_visa"
  | "progress_payment";

export type ProcessDocumentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";

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
  updateStatus(input: {
    documentId: string;
    status: ProcessDocumentStatus;
    lastComment?: string | null;
  }): Promise<ProcessDocumentRecord>;
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
}
