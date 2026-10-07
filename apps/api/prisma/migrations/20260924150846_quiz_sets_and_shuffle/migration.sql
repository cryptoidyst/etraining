-- AlterTable
ALTER TABLE "course_questions" ADD COLUMN     "set_index" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "shuffle_options" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shuffle_questions" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "quiz_attempts" ADD COLUMN     "option_order" JSONB,
ADD COLUMN     "question_order" JSONB,
ADD COLUMN     "set_index" INTEGER;
