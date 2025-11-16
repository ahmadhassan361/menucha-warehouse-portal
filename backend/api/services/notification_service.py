import logging
import csv
from io import StringIO
from django.core.mail import send_mail, EmailMessage
from django.core.mail import get_connection
from django.conf import settings
from typing import List, Tuple
from twilio.rest import Client
from twilio.base.exceptions import TwilioRestException
from ..models import StockException, EmailSMSSettings

logger = logging.getLogger(__name__)


class NotificationService:
    """
    Service to handle email and SMS notifications
    Used primarily for out-of-stock reports
    """
    
    @staticmethod
    def send_email_notification(
        recipients: List[str] = None,
        subject: str = None,
        message: str = None,
        exceptions: List[StockException] = None
    ) -> Tuple[bool, str]:
        """
        Send email notification with stock exceptions
        
        Args:
            recipients: List of email addresses (optional, uses settings if not provided)
            subject: Email subject (optional)
            message: Email message body (optional)
            exceptions: List of stock exceptions to include (optional)
            
        Returns:
            (success: bool, message: str)
        """
        try:
            # Get email settings
            email_settings = EmailSMSSettings.get_settings()
            
            if not email_settings.email_enabled:
                return False, "Email notifications are disabled in settings"
            
            # Use default recipients if not provided
            if not recipients:
                recipients = email_settings.notification_recipients
            
            if not recipients:
                return False, "No email recipients configured"
            
            # Build email content
            if not subject:
                subject = "Out-of-Stock Report"
            
            if not message:
                message = NotificationService._build_email_body(exceptions)
            
            # Create custom email connection with SSL/TLS support
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=email_settings.smtp_host,
                port=email_settings.smtp_port,
                username=email_settings.smtp_username,
                password=email_settings.smtp_password,
                use_tls=email_settings.smtp_use_tls,
                use_ssl=email_settings.smtp_use_ssl,
                fail_silently=False,
            )
            
            # Send email using custom connection
            email = EmailMessage(
                subject=subject,
                body=message,
                from_email=email_settings.from_email or settings.DEFAULT_FROM_EMAIL,
                to=recipients,
                connection=connection
            )
            email.send()
            
            logger.info(f"Email sent successfully to {len(recipients)} recipient(s)")
            return True, f"Email sent to {len(recipients)} recipient(s)"
            
        except Exception as e:
            error_msg = f"Failed to send email: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    @staticmethod
    def send_sms_notification(
        recipients: List[str] = None,
        message: str = None,
        exceptions: List[StockException] = None
    ) -> Tuple[bool, str]:
        """
        Send SMS notification with stock exceptions
        
        Args:
            recipients: List of phone numbers (optional, uses settings if not provided)
            message: SMS message body (optional)
            exceptions: List of stock exceptions to include (optional)
            
        Returns:
            (success: bool, message: str)
        """
        try:
            # Get SMS settings
            sms_settings = EmailSMSSettings.get_settings()
            
            if not sms_settings.sms_enabled:
                return False, "SMS notifications are disabled in settings"
            
            # Use default recipients if not provided
            if not recipients:
                recipients = sms_settings.sms_recipients
            
            if not recipients:
                return False, "No SMS recipients configured"
            
            # Build SMS content
            if not message:
                message = NotificationService._build_sms_body(exceptions)
            
            # Initialize Twilio client
            client = Client(
                sms_settings.twilio_account_sid,
                sms_settings.twilio_auth_token
            )
            
            # Send SMS to each recipient
            sent_count = 0
            failed = []
            
            for phone_number in recipients:
                try:
                    client.messages.create(
                        body=message,
                        from_=sms_settings.twilio_from_number,
                        to=phone_number
                    )
                    sent_count += 1
                    logger.info(f"SMS sent successfully to {phone_number}")
                    
                except TwilioRestException as e:
                    logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
                    failed.append(phone_number)
            
            if sent_count > 0:
                result_msg = f"SMS sent to {sent_count} recipient(s)"
                if failed:
                    result_msg += f". Failed: {len(failed)}"
                return True, result_msg
            else:
                return False, f"Failed to send SMS to all {len(recipients)} recipient(s)"
                
        except Exception as e:
            error_msg = f"Failed to send SMS: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return False, error_msg
    
    @staticmethod
    def _build_email_body(exceptions: List[StockException] = None) -> str:
        """Build email body with stock exceptions"""
        if not exceptions:
            exceptions = StockException.objects.filter(resolved=False).order_by('-timestamp')
        
        if not exceptions:
            return "No unresolved stock exceptions at this time."
        
        body = "Out-of-Stock Report\n"
        body += "=" * 50 + "\n\n"
        
        for exc in exceptions:
            body += f"SKU: {exc.sku}\n"
            body += f"Product: {exc.product_title}\n"
            body += f"Category: {exc.category}\n"
            body += f"Quantity Short: {exc.qty_short}\n"
            body += f"Affected Orders: {', '.join(map(str, exc.order_numbers))}\n"
            body += f"Reported: {exc.timestamp.strftime('%Y-%m-%d %H:%M')}\n"
            if exc.notes:
                body += f"Notes: {exc.notes}\n"
            body += "-" * 50 + "\n"
        
        body += f"\nTotal Exceptions: {len(exceptions)}\n"
        
        return body
    
    @staticmethod
    def _build_sms_body(exceptions: List[StockException] = None) -> str:
        """Build SMS body with stock exceptions (shortened for SMS)"""
        if not exceptions:
            exceptions = StockException.objects.filter(resolved=False).order_by('-timestamp')[:5]  # Limit to 5 for SMS
        
        if not exceptions:
            return "No unresolved stock exceptions."
        
        body = "Out-of-Stock Alert:\n"
        
        for exc in exceptions[:5]:  # Max 5 items for SMS
            order_list = ', '.join(map(str, exc.order_numbers[:3]))  # Max 3 orders
            if len(exc.order_numbers) > 3:
                order_list += "..."
            body += f"• {exc.sku}: {exc.qty_short} short (Orders: {order_list})\n"
        
        if len(exceptions) > 5:
            body += f"...and {len(exceptions) - 5} more items\n"
        
        return body
    
    @staticmethod
    def export_exceptions_to_csv(exceptions: List[StockException] = None) -> str:
        """
        Export stock exceptions to CSV format
        
        Returns:
            CSV content as string
        """
        if not exceptions:
            exceptions = StockException.objects.filter(resolved=False).order_by('-timestamp')
        
        # Create CSV in memory
        output = StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'SKU',
            'Product Title',
            'Category',
            'Quantity Short',
            'Order Numbers',
            'Reported By',
            'Timestamp',
            'Resolved',
            'Notes'
        ])
        
        # Write data rows
        for exc in exceptions:
            writer.writerow([
                exc.sku,
                exc.product_title,
                exc.category,
                exc.qty_short,
                ', '.join(map(str, exc.order_numbers)),
                exc.reported_by.username if exc.reported_by else 'Unknown',
                exc.timestamp.strftime('%Y-%m-%d %H:%M:%S'),
                'Yes' if exc.resolved else 'No',
                exc.notes
            ])
        
        return output.getvalue()
    
    @staticmethod
    def test_email_settings() -> Tuple[bool, str]:
        """
        Test email settings by sending a test email
        
        Returns:
            (success: bool, message: str)
        """
        try:
            email_settings = EmailSMSSettings.get_settings()
            
            if not email_settings.email_enabled:
                return False, "Email notifications are disabled"
            
            if not email_settings.notification_recipients:
                return False, "No email recipients configured"
            
            # Create custom email connection with SSL/TLS support
            connection = get_connection(
                backend='django.core.mail.backends.smtp.EmailBackend',
                host=email_settings.smtp_host,
                port=email_settings.smtp_port,
                username=email_settings.smtp_username,
                password=email_settings.smtp_password,
                use_tls=email_settings.smtp_use_tls,
                use_ssl=email_settings.smtp_use_ssl,
                fail_silently=False,
            )
            
            # Send test email using custom connection
            email = EmailMessage(
                subject="Test Email - Order Picking System",
                body="This is a test email from the Order Picking System. Your email configuration is working correctly.",
                from_email=email_settings.from_email or settings.DEFAULT_FROM_EMAIL,
                to=email_settings.notification_recipients[:1],  # Send to first recipient only
                connection=connection
            )
            email.send()
            
            return True, "Test email sent successfully"
            
        except Exception as e:
            return False, f"Failed to send test email: {str(e)}"
    
    @staticmethod
    def test_sms_settings() -> Tuple[bool, str]:
        """
        Test SMS settings by sending a test SMS
        
        Returns:
            (success: bool, message: str)
        """
        try:
            sms_settings = EmailSMSSettings.get_settings()
            
            if not sms_settings.sms_enabled:
                return False, "SMS notifications are disabled"
            
            if not sms_settings.sms_recipients:
                return False, "No SMS recipients configured"
            
            # Initialize Twilio client
            client = Client(
                sms_settings.twilio_account_sid,
                sms_settings.twilio_auth_token
            )
            
            # Send test SMS to first recipient only
            client.messages.create(
                body="Test message from Order Picking System. Your SMS configuration is working correctly.",
                from_=sms_settings.twilio_from_number,
                to=sms_settings.sms_recipients[0]
            )
            
            return True, "Test SMS sent successfully"
            
        except TwilioRestException as e:
            return False, f"Twilio error: {str(e)}"
        except Exception as e:
            return False, f"Failed to send test SMS: {str(e)}"
