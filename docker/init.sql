-- M1 throwaway table; M2/M4 replaces with Task Model + real migrations
CREATE TABLE tasks (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	title text NOT NULL,
	completed boolean NOT NULL DEFAULT false,
	created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO tasks (title) VALUES
	('Buy oat milk'),
	('Meal prep for Monday'),
	('Order paper towels');
