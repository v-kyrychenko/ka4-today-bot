import {log} from "../utils/logger.js";

/**
 * Processor for OpenAI function calls (tool calling).
 */
const openAiFunctionProcessor = {

    /**
     * Generates a list of available exercises for a given user.
     *
     * @param {Object} args - Arguments passed from the Assistant API.
     * @param {string} args.chatId - The unique identifier of the chat/user.
     * @returns {Promise<Object>} - The output object to be sent back to the Assistant API.
     */
    getAvailableExercises: async ({chatId}) => {
        log(`Get exercises for ${chatId}`)
        //TODO IMPL. Example logic: fetch exercises from DB or service
        // Here is a placeholder for the real implementation
        // Replace this with actual data retrieval (e.g., DynamoDB, etc.)
        const exercises = [
            {name: "Push-ups", equipment: "bodyweight", level: "beginner", muscle_group: "chest"},
            {name: "Squats", equipment: "bodyweight", level: "beginner", muscle_group: "legs"},
            {name: "Plank", equipment: "bodyweight", level: "beginner", muscle_group: "core"}
        ];

        // Optionally filter exercises based on chat_id or user preferences
        // (example: personalized recommendation)

        return {exercises};
    }
};

export default openAiFunctionProcessor;
