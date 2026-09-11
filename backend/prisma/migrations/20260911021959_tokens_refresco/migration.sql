-- CreateTable
CREATE TABLE "TokenRefresco" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "hashToken" TEXT NOT NULL,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadoEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,

    CONSTRAINT "TokenRefresco_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TokenRefresco_hashToken_key" ON "TokenRefresco"("hashToken");

-- CreateIndex
CREATE INDEX "TokenRefresco_usuarioId_idx" ON "TokenRefresco"("usuarioId");

-- CreateIndex
CREATE INDEX "TokenRefresco_expiraEn_idx" ON "TokenRefresco"("expiraEn");

-- AddForeignKey
ALTER TABLE "TokenRefresco" ADD CONSTRAINT "TokenRefresco_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
