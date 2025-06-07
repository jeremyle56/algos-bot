import 'dotenv/config';
import {
  Client,
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  InteractionType,
  ChannelType,
  GuildTextBasedChannel,
  MessageFlags,
} from 'discord.js';

// Category name for output channels
const LABS_CATEGORY = 'Labs [25T2]';

// Create a new Discord client
const client = new Client({
  intents: ['Guilds', 'GuildMessages', 'MessageContent'],
});

client.on('ready', async (c) => {
  console.log(`${c.user.username} is online.`);

  // Register the announce command
  const announceCommand = new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Announce number of RFF tasks to respective channels');

  await c.application?.commands.create(announceCommand);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand() && interaction.commandName === 'announce') {
    // Display data input modal for input
    const modal = new ModalBuilder()
      .setCustomId('announce-modal')
      .setTitle('Announce No. RFF Tasks');

    // Custom message input
    const messageInput = new TextInputBuilder()
      .setCustomId('announce-message')
      .setLabel('Announcement Message')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    // Data input for number of RFF tasks
    const dataInput = new TextInputBuilder()
      .setCustomId('rff-lab-data')
      .setLabel('Data [Lab]-[Group] - [No. RFF Tasks]')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(messageInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(dataInput);

    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
  } else if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === 'announce-modal'
  ) {
    // Retrieve data from input modal
    const message = interaction.fields.getTextInputValue('announce-message');
    const data = interaction.fields
      .getTextInputValue('rff-lab-data')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    // Store data for each lab
    const labs: Record<string, string[]> = {};

    // Process data into lab classes
    for (const group of data) {
      const labMatch = group.match(/^([A-Za-z0-9]+)-/);
      if (!labMatch) continue;

      const labClass = labMatch[1].toLowerCase();
      if (!labs[labClass]) labs[labClass] = [];
      labs[labClass].push(group);
    }

    // Find the server
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: 'Error: could not find guild.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Find the category for lab channels within server
    const category = guild.channels.cache.find(
      (c) => c.type === ChannelType.GuildCategory && c.name === LABS_CATEGORY
    );
    if (!category) {
      await interaction.reply({
        content: `Error: could not find category "${LABS_CATEGORY}".`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Announce messages to each lab channel
    const res: string[] = [];
    for (const [lab, output] of Object.entries(labs)) {
      // Find corresponding channel in category for lab
      const channel = guild.channels.cache.find(
        (c) =>
          c.parentId === category.id &&
          c.type === ChannelType.GuildText &&
          c.name === lab.toLowerCase()
      ) as GuildTextBasedChannel | undefined;

      // Can not find lab, add error to res
      if (!channel) {
        res.push(`❌ Channel #${lab.toLowerCase()} not found.`);
        continue;
      }

      // Send message to channel
      await channel.send(`${message}\n` + output.join('\n'));
      res.push(`✅ Announced to #${lab.toLowerCase()}`);
    }

    // Reply with status of announcement
    await interaction.reply({
      content: res.join('\n') + `\n\n Total Labs: ${res.length}`,
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.login(process.env.TOKEN);
