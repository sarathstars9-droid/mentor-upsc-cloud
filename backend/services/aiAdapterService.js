export async function generateMentorReply({ mentorState, currentStage, userMessage, session }) {
  let nextStage = currentStage;
  let message = '';
  let extracted = {};

  const lowerUser = userMessage.toLowerCase();
  
  // Deterministic fallback state machine without AI
  switch (currentStage) {
    case 'energy': // Greeting -> Energy check is done. Expecting energy.
      extracted.energy_level = userMessage; // the test checks exact string 'I feel energetic'
      message = `Understood. Now, how many hours do you realistically have available to study today?`;
      nextStage = 'available_hours';
      break;

    case 'available_hours': // Expecting available-time
      extracted.available_hours = userMessage;
      nextStage = 'obstacle';
      const command = mentorState.mentorCommand || { title: 'plan', instruction: 'Do it.', reason: 'Important.' };
      message = `I see. Here is your priority right now: ${command.title}. ${command.instruction} ${command.reason} What is the main obstacle you foresee in completing this?`;
      break;

    case 'obstacle': // Expecting obstacle
      extracted.obstacle = userMessage;
      nextStage = 'commitment';
      message = `We can manage that obstacle. Will you commit to starting this block immediately after we finish here?`;
      break;

    case 'commitment': // Expecting first-block commitment
      extracted.first_block_commitment = userMessage;
      extracted.instruction_accepted = lowerUser.includes('yes') || lowerUser.includes('will') || lowerUser.includes('ok') || lowerUser.includes('sure');
      nextStage = 'completed';
      message = `Good. I have recorded your commitment. Will you also commit to completing your CSAT practice today?`;
      break;

    case 'csat_commitment': // Expecting CSAT commitment
      extracted.csat_commitment = userMessage;
      nextStage = 'final_commitment';
      message = `Excellent. Confirm your final commitment to today's plan, and we can close this session.`;
      break;

    case 'final_commitment': // Expecting Confirmation
      extracted.final_commitment = userMessage;
      nextStage = 'completed';
      message = `Good. Start the first block now. MentorOS will expect completion evidence after the block.`;
      break;

    case 'completed': // Close
      message = `The check-in is complete. Focus on your execution.`;
      break;
      
    default:
      message = `Let's stick to the plan. Execute the blocks.`;
      break;
  }

  return {
    message,
    nextStage,
    extracted
  };
}
