-- Allow dynamic category values in questions.type

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_type_check;

