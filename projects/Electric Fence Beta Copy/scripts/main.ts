class main extends SystemScript {
  onInit() {
    console.log('Main script onInit.');
  }

  onHostStart() {
    // Main entry point for the host/server.
    console.log('Main script onHostStart: Attaching GameManager...');

    // Attach the core GameManager system script
    try {
      scriptManager.attachSystem({ scriptId: 'GameManager' });
      console.log(
        'Main script onHostStart: GameManager attached successfully.',
      );
    } catch (error) {
      console.log(
        '!!! Main script CRITICAL ERROR: Failed to attach GameManager:',
        error,
      );
    }
  }
} // End class main