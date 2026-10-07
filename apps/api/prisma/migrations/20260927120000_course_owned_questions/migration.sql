-- Questions become course-owned templates: every question belongs to exactly
-- one course and one quiz set of that course. Ownership is backfilled from the
-- legacy course_questions join table (lowest course/set wins); orphaned
-- questions that were never attached to any course are removed.

-- Remove orphaned question templates (no owning course can be determined).
DELETE FROM "quiz_answer_options" qao
USING "quiz_answers" qa
WHERE qao."answer_id" = qa."id"
  AND qa."question_id" IN (SELECT "id" FROM "questions" WHERE "id" NOT IN (SELECT "question_id" FROM "course_questions"));

DELETE FROM "quiz_answers"
WHERE "question_id" IN (SELECT "id" FROM "questions" WHERE "id" NOT IN (SELECT "question_id" FROM "course_questions"));

DELETE FROM "questions"
WHERE "id" NOT IN (SELECT "question_id" FROM "course_questions");

-- Add the ownership columns (nullable first so we can backfill).
ALTER TABLE "questions"
  ADD COLUMN "course_id" UUID,
  ADD COLUMN "set_index" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "order_index" INTEGER NOT NULL DEFAULT 0;

-- Backfill from course_questions: lowest course id / set index / order wins.
UPDATE "questions" q
SET "course_id" = src."course_id",
    "set_index" = src."set_index",
    "order_index" = src."order_index"
FROM (
  SELECT DISTINCT ON ("question_id") "question_id", "course_id", "set_index", "order_index"
  FROM "course_questions"
  ORDER BY "question_id", "course_id", "set_index", "order_index"
) src
WHERE q."id" = src."question_id";

ALTER TABLE "questions" ALTER COLUMN "course_id" SET NOT NULL;

ALTER TABLE "questions"
  ADD CONSTRAINT "questions_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "questions_course_id_set_index_idx" ON "questions"("course_id", "set_index");
