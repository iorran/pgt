CREATE TABLE "seminar_participant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_id" uuid NOT NULL,
	"student_id" uuid,
	"name" varchar(255),
	"phone" varchar(50),
	"amount" numeric(10, 2) NOT NULL,
	"paid_at" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "seminar_participant_class_student_uq" UNIQUE("class_id","student_id")
);
--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "teacher_id" uuid;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "guest_teacher_name" varchar(255);--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "is_seminar" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "student_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "class" ADD COLUMN "outsider_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "seminar_participant" ADD CONSTRAINT "seminar_participant_class_id_class_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."class"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seminar_participant" ADD CONSTRAINT "seminar_participant_student_id_user_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class" ADD CONSTRAINT "class_teacher_id_user_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;