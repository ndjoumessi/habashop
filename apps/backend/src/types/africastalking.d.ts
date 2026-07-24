// Déclaration de type MINIMALE pour le SDK Africa's Talking (pas de types officiels).
// On ne type que ce qu'on utilise : SMS.send. Le reste est volontairement absent.
declare module 'africastalking' {
  interface SmsRecipient { number: string; status: string; statusCode: number; messageId: string; cost: string }
  interface SmsSendResult { SMSMessageData: { Message: string; Recipients: SmsRecipient[] } }
  interface SmsService {
    send(opts: { to: string[]; message: string; from?: string }): Promise<SmsSendResult>
  }
  interface AfricasTalkingClient { SMS: SmsService }
  function AfricasTalking(credentials: { apiKey: string; username: string }): AfricasTalkingClient
  export = AfricasTalking
}
