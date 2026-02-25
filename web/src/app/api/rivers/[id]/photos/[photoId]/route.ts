import { prisma } from "@/lib/db";
import { apiError, handleApiError } from "@/lib/api-errors";
import { withAuth } from "@/lib/api-middleware";

export const DELETE = withAuth(async (
  request: Request,
  context?: unknown
) => {
  try {
    const { id: riverId, photoId } = await (context as { params: Promise<{ id: string; photoId: string }> }).params;
    const userId = request.headers.get("x-user-id")!;

    const photo = await prisma.riverPhoto.findFirst({
      where: { id: photoId, riverId },
    });

    if (!photo) {
      return apiError(404, "Photo not found");
    }

    if (photo.userId !== userId) {
      return apiError(403, "You can only delete your own photos");
    }

    await prisma.riverPhoto.delete({ where: { id: photoId } });

    return new Response(null, { status: 204 });
  } catch (error) {
    return handleApiError(error);
  }
});
