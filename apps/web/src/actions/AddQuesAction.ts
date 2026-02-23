"use server";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import { prisma } from "@buzrr/prisma";
import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  secure: true,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Function to extract public ID from the URL
function getPublicIdFromUrl(url: string) {
  const parts = url.split("/");
  const publicIdWithExtension = parts[parts.length - 1];
  const [publicId] = publicIdWithExtension.split(".");
  return publicId;
}

export default async function addQues(formData: FormData) {
  try {
    const title = formData.get("title") as string;
    const option1 = formData.get("option1") as string;
    const option2 = formData.get("option2") as string;
    const option3 = formData.get("option3") as string;
    const option4 = formData.get("option4") as string;
    const time = formData.get("time") as string;
    const quizId = formData.get("quiz_id") as string;
    const quesId = formData.get("ques_id") as string;
    const correct_option = formData.get("choose_option") as string;
    const options = [
      { title: option1, isCorrect: correct_option === "a" ? true : false },
      { title: option2, isCorrect: correct_option === "b" ? true : false },
      { title: option3, isCorrect: correct_option === "c" ? true : false },
      { title: option4, isCorrect: correct_option === "d" ? true : false },
    ];

    const file = formData.get("file") as File;
    const file_link = formData.get("file_link") as string;
    const file_type = formData.get("media_type") as string;
    let fileLink = "";
    let fileType = "";

    if (file.size != 0) {
      if (file_link) {
        const oldPublicId = getPublicIdFromUrl(file_link);
        await cloudinary.uploader.destroy(
          oldPublicId,
          function (error, result) {
            if (error) {
              console.log("Error deleting old file:", error);
            } else {
              console.log("Old file deleted:", result);
            }
          },
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({}, function (error, result) {
            if (error) {
              reject(error);
            }
            fileLink = result?.secure_url || "";
            fileType = result?.resource_type || "";
            resolve(result);
          })
          .end(buffer);
      });
    } else if (file.size == 0 && file_link) {
      fileLink = file_link;
      fileType = file_type;
    }

    const session = await auth();
    if (!session || !session.user) redirect("/api/auth/signin");

    if (quesId) {
      const question = await prisma.question.findUnique({
        where: { id: quesId },
        include: { options: true },
      });

      const ques_options = question?.options || [];

      await prisma.question.update({
        where: {
          id: quesId,
        },
        data: {
          title,
          quizId: quizId,
          timeOut: parseInt(time) || 15,
          media: fileLink,
          mediaType: fileType,
          options: {
            upsert: options.map((option, index) => ({
              where: { id: ques_options[index]?.id || "" },
              create: option,
              update: option,
            })),
          },
        },
      });
    } else {
      const total_questions = await prisma.question.findMany({
        where: { quizId: quizId },
      });

      await prisma.question.create({
        data: {
          title,
          options: {
            create: options,
          },
          quizId: quizId,
          timeOut: parseInt(time) || 15,
          media: fileLink,
          mediaType: fileType,
          order: total_questions.length + 1,
        },
      });
    }
    revalidatePath(`/quiz/${quizId}`);
  } catch (err: unknown) {
    return {
      error: err instanceof Error ? err.message : "Something went wrong",
    };
  }
}
