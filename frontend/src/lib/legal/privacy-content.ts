import type { Locale } from "@/lib/i18n";

export interface PrivacySection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface PrivacyContent {
  title: string;
  lastUpdated: string;
  sections: PrivacySection[];
  contactTeam: string;
  contactEmail: string;
  footer: string;
}

const en: PrivacyContent = {
  title: "Privacy Policy",
  lastUpdated: "Sentra — Last Updated: March 2026",
  sections: [
    {
      title: "1. Introduction",
      paragraphs: [
        "Welcome to Sentra. We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Sentra browser extension and associated services.",
      ],
    },
    {
      title: "2. Information We Collect",
      paragraphs: [
        "We collect information that can reasonably be linked to you (\"Personal Data\") in the following categories:",
      ],
      bullets: [
        "Account information you provide (such as email and username).",
        "Support and feedback content you submit.",
        "Technical metadata (browser, OS, extension events).",
        "Anonymized or hashed URL signals used for threat detection.",
      ],
    },
    {
      title: "3. How We Use Your Information",
      paragraphs: [
        "We use collected information to operate and improve the Service, detect threats in real time, provide account support, and comply with legal obligations.",
      ],
    },
    {
      title: "4. Data Sharing and Disclosure",
      paragraphs: [
        "We do not sell your Personal Data. We may share limited data with trusted service providers for infrastructure operations and when required by law.",
      ],
    },
    {
      title: "5. User Rights and Choices",
      paragraphs: [
        "Depending on your region, you may have rights to access, correct, delete, or restrict processing of your personal data, and to withdraw consent where applicable.",
      ],
    },
    {
      title: "6. Data Security",
      paragraphs: [
        "We apply technical and organizational safeguards to protect your data. However, no internet transmission can be guaranteed as absolutely secure.",
      ],
    },
    {
      title: "7. Data Retention",
      paragraphs: [
        "We retain personal data only as long as necessary to provide the Service and meet legal obligations.",
      ],
    },
    {
      title: "8. Children's Privacy",
      paragraphs: [
        "Our Service is not directed to children under 13. If we discover unauthorized collection of such data, we will take prompt steps to delete it.",
      ],
    },
    {
      title: "9. International Data Transfers",
      paragraphs: [
        "Your data may be processed in jurisdictions outside your country. We implement safeguards to protect your data during such transfers.",
      ],
    },
    {
      title: "10. Changes to This Privacy Policy",
      paragraphs: [
        "We may update this policy from time to time. Material changes will be communicated through the product or other appropriate channels.",
      ],
    },
    {
      title: "11. Contact Us",
      paragraphs: ["If you have any questions about this Privacy Policy, please contact us at:"],
    },
  ],
  contactTeam: "Sentra Support Team",
  contactEmail: "cyberlab.dev@gmail.com",
  footer: "Privacy Policy — Last Updated: March 2026",
};

const vi: PrivacyContent = {
  title: "Chính sách Bảo mật",
  lastUpdated: "Sentra — Cập nhật lần cuối: tháng 03/2026",
  sections: [
    {
      title: "1. Giới thiệu",
      paragraphs: [
        "Chào mừng bạn đến với Sentra. Chúng tôi tôn trọng quyền riêng tư và cam kết bảo vệ dữ liệu cá nhân của bạn. Chính sách này mô tả cách chúng tôi thu thập, sử dụng, chia sẻ và bảo vệ thông tin khi bạn dùng tiện ích Sentra và các dịch vụ liên quan.",
      ],
    },
    {
      title: "2. Thông tin chúng tôi thu thập",
      paragraphs: [
        "Chúng tôi thu thập thông tin có thể liên kết hợp lý với bạn (\"Dữ liệu cá nhân\") theo các nhóm sau:",
      ],
      bullets: [
        "Thông tin tài khoản bạn cung cấp (như email và username).",
        "Nội dung hỗ trợ/phản hồi bạn gửi.",
        "Metadata kỹ thuật (trình duyệt, hệ điều hành, sự kiện tiện ích).",
        "Tín hiệu URL đã ẩn danh hoặc băm để phát hiện mối đe dọa.",
      ],
    },
    {
      title: "3. Cách chúng tôi sử dụng thông tin",
      paragraphs: [
        "Chúng tôi sử dụng dữ liệu để vận hành và cải thiện Dịch vụ, phát hiện mối đe dọa theo thời gian thực, hỗ trợ tài khoản và tuân thủ nghĩa vụ pháp lý.",
      ],
    },
    {
      title: "4. Chia sẻ và tiết lộ dữ liệu",
      paragraphs: [
        "Chúng tôi không bán dữ liệu cá nhân. Chúng tôi chỉ chia sẻ dữ liệu cần thiết với nhà cung cấp dịch vụ đáng tin cậy để vận hành hạ tầng hoặc khi pháp luật yêu cầu.",
      ],
    },
    {
      title: "5. Quyền và lựa chọn của người dùng",
      paragraphs: [
        "Tùy khu vực, bạn có thể có quyền truy cập, chỉnh sửa, xóa, hạn chế xử lý dữ liệu cá nhân và rút lại sự đồng ý khi áp dụng.",
      ],
    },
    {
      title: "6. Bảo mật dữ liệu",
      paragraphs: [
        "Chúng tôi áp dụng các biện pháp kỹ thuật và tổ chức để bảo vệ dữ liệu. Tuy nhiên, không có truyền tải internet nào đảm bảo an toàn tuyệt đối.",
      ],
    },
    {
      title: "7. Thời gian lưu trữ dữ liệu",
      paragraphs: [
        "Chúng tôi chỉ lưu dữ liệu cá nhân trong thời gian cần thiết để cung cấp Dịch vụ và đáp ứng yêu cầu pháp lý.",
      ],
    },
    {
      title: "8. Quyền riêng tư của trẻ em",
      paragraphs: [
        "Dịch vụ không dành cho trẻ em dưới 13 tuổi. Nếu phát hiện có thu thập dữ liệu không phù hợp, chúng tôi sẽ xóa ngay.",
      ],
    },
    {
      title: "9. Chuyển dữ liệu quốc tế",
      paragraphs: [
        "Dữ liệu có thể được xử lý ngoài quốc gia cư trú của bạn. Chúng tôi áp dụng biện pháp bảo vệ phù hợp cho việc chuyển dữ liệu.",
      ],
    },
    {
      title: "10. Thay đổi chính sách",
      paragraphs: [
        "Chúng tôi có thể cập nhật chính sách theo thời gian. Các thay đổi quan trọng sẽ được thông báo qua sản phẩm hoặc kênh phù hợp.",
      ],
    },
    {
      title: "11. Liên hệ",
      paragraphs: ["Nếu bạn có câu hỏi về Chính sách Bảo mật, vui lòng liên hệ:"],
    },
  ],
  contactTeam: "Đội ngũ hỗ trợ Sentra",
  contactEmail: "cyberlab.dev@gmail.com",
  footer: "Chính sách Bảo mật — Cập nhật lần cuối: tháng 03/2026",
};

export function getPrivacyContent(locale: Locale): PrivacyContent {
  return locale === "vi" ? vi : en;
}
