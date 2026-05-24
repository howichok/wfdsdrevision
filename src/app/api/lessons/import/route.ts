import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { topics, questions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const { fileName } = await req.json();

    if (!fileName) {
      return NextResponse.json({ error: "Missing fileName" }, { status: 400 });
    }

    let topicTitle = "";
    let topicDescription = "";
    let questionList: any[] = [];

    if (fileName.includes("SQL_Constraints")) {
      topicTitle = "SQL Constraints & Entity Integrity";
      topicDescription =
        "Master relational database rules including Primary Keys, Foreign Keys, Unique constraints, and Referential Integrity behaviors.";
      questionList = [
        {
          title: "Primary vs. Foreign Keys",
          text: "Explain the difference between a Primary Key and a Foreign Key. Why is referential integrity important in relational database schemas?",
          type: "short_answer",
          difficulty: "easy",
          sampleAnswer:
            "A Primary Key uniquely identifies each row in a table and cannot contain NULL values. A Foreign Key is a field in one table that refers to the Primary Key in another table, creating a relationship between them. Referential integrity prevents orphan records by ensuring that a foreign key value must match an existing primary key value in the parent table.",
          gradingCriteria: [
            { criterion: "State that Primary Key uniquely identifies rows and cannot be null", maxPoints: 40 },
            { criterion: "Explain that Foreign Key references a Primary Key in another table", maxPoints: 40 },
            { criterion: "Define referential integrity and why it prevents orphan records", maxPoints: 20 },
          ],
        },
        {
          title: "Cascade vs. Restrict deletion behaviors",
          text: "Describe the operational differences between ON DELETE CASCADE and ON DELETE SET NULL when a parent row is deleted.",
          type: "essay",
          difficulty: "medium",
          sampleAnswer:
            "ON DELETE CASCADE automatically deletes all child rows in the referencing table when the corresponding parent row is deleted. In contrast, ON DELETE SET NULL keeps the child rows but updates their foreign key fields to NULL. Cascade is used when child records cannot exist without the parent, whereas Set Null is preferred when the relationship is optional.",
          gradingCriteria: [
            { criterion: "Explain ON DELETE CASCADE operation clearly", maxPoints: 45 },
            { criterion: "Explain ON DELETE SET NULL operation clearly", maxPoints: 45 },
            { criterion: "Provide a scenario/use-case comparison for both", maxPoints: 10 },
          ],
        },
      ];
    } else if (fileName.includes("Normalization")) {
      topicTitle = "Database Normalization (1NF, 2NF, 3NF)";
      topicDescription =
        "Learn how to structure relational database tables to reduce redundancy and remove update anomalies by normalizing up to 3NF.";
      questionList = [
        {
          title: "Explaining Third Normal Form (3NF)",
          text: "Explain the requirements for a database table to be in Third Normal Form (3NF). In your explanation, define transitive dependency and explain how it is resolved.",
          type: "essay",
          difficulty: "medium",
          sampleAnswer:
            "For a table to be in 3NF, it must first satisfy 1NF and 2NF. Additionally, all non-prime attributes must be mutually independent and directly dependent on the primary key. This means there are no transitive dependencies, where a non-prime attribute determines another non-prime attribute (i.e. X -> Y and Y -> Z). To resolve transitive dependencies, we split the table, moving Y and Z to a separate relation where Y becomes the primary key.",
          gradingCriteria: [
            { criterion: "Satisfy 1NF and 2NF first", maxPoints: 20 },
            {
              criterion: "Define transitive dependency (non-prime determining non-prime)",
              maxPoints: 40,
            },
            { criterion: "Explain resolution by splitting relation into two tables", maxPoints: 40 },
          ],
        },
      ];
    } else {
      return NextResponse.json({ error: "Unsupported study material format" }, { status: 400 });
    }

    // Check if topic already exists to prevent duplicate spam
    const existing = await db.query.topics.findFirst({
      where: eq(topics.title, topicTitle),
    });

    if (existing) {
      return NextResponse.json({
        ok: true,
        message: "Topic was already imported previously.",
        topicId: existing.id,
      });
    }

    // Insert new topic
    const [newTopic] = await db
      .insert(topics)
      .values({
        title: topicTitle,
        description: topicDescription,
      })
      .returning();

    // Insert questions
    if (questionList.length > 0) {
      await db.insert(questions).values(
        questionList.map((q) => ({
          ...q,
          topicId: newTopic.id,
        }))
      );
    }

    return NextResponse.json({
      ok: true,
      message: `Successfully imported "${topicTitle}" to Revision Hub!`,
      topicId: newTopic.id,
    });
  } catch (err: any) {
    console.error("Error importing class material:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
