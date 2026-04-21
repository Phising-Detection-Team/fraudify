import type { Locale } from "@/lib/i18n";

export interface TermsSection {
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

interface TermsContent {
  sections: TermsSection[];
  contactTeam: string;
  contactEmail: string;
}

const en: TermsContent = {
  sections: [
    {
      title: "1. Acceptance of Terms",
      paragraphs: [
        "By installing, accessing, or using the Sentra browser extension (\"Extension\") or its associated web platform (\"Service\"), you (\"User\") agree to be bound by these Terms & Agreements (\"Terms\"). If you do not agree to these Terms in their entirety, you must not install or use the Extension or Service.",
      ],
    },
    {
      title: "2. Description of Service",
      paragraphs: [
        "Sentra is a browser extension designed to detect and warn users about potential phishing websites, malicious links, and fraudulent online content in real time.",
        "The Extension operates as a client-side tool that communicates with our backend servers to retrieve threat intelligence and submit anonymized URL scan data.",
      ],
    },
    {
      title: "3. Eligibility",
      paragraphs: [
        "You must be at least 13 years of age to use the Service. If you are under 18, your parent or legal guardian must review and agree to these Terms on your behalf.",
      ],
    },
    {
      title: "4. User Account & Registration",
      paragraphs: [
        "Certain features require account registration. You agree to provide accurate, current, and complete information and to keep it updated.",
        "You are solely responsible for safeguarding your account credentials and all activities under your account.",
      ],
    },
    {
      title: "5. Data Collection & Privacy",
      paragraphs: [
        "Your use of the Service is governed by our Privacy Policy, incorporated into these Terms by reference.",
        "What we collect: anonymized URLs, extension interaction events, device metadata, and account data voluntarily provided.",
        "What we do not collect: passwords, form inputs, payment information, or full web page content.",
      ],
    },
    {
      title: "6. Permitted Use",
      paragraphs: ["You agree to use the Extension and Service only for lawful purposes. You must not:"],
      bullets: [
        "Reverse-engineer, decompile, or disassemble the Extension or backend systems.",
        "Use the Service to facilitate phishing, fraud, or malicious activity.",
        "Interfere with or disrupt the integrity or performance of the Service.",
        "Submit false threat reports to harm legitimate websites.",
        "Circumvent or disable security features.",
      ],
    },
    {
      title: "7. Intellectual Property",
      paragraphs: [
        "All rights, title, and interest in the Extension, Service, software, machine-learning models, and brand assets are owned by or licensed to Sentra.",
      ],
    },
    {
      title: "8. Disclaimers & Limitation of Liability",
      paragraphs: [
        "THE SERVICE IS PROVIDED \"AS IS\" AND \"AS AVAILABLE\" WITHOUT WARRANTIES OF ANY KIND.",
        "No security tool is infallible. To the maximum extent permitted by law, Sentra is not liable for indirect damages arising from your use of the Service.",
      ],
    },
    {
      title: "9. Indemnification",
      paragraphs: [
        "You agree to indemnify and hold harmless Sentra and its team from claims arising out of your use of the Service or your violation of these Terms.",
      ],
    },
    {
      title: "10. Termination",
      paragraphs: [
        "We reserve the right to suspend or terminate your account or access to the Service at any time for violations of these Terms or abuse of the platform.",
      ],
    },
    {
      title: "11. Changes to These Terms",
      paragraphs: [
        "We may update these Terms from time to time. Material changes will be communicated in advance where required.",
      ],
    },
    {
      title: "12. Governing Law & Dispute Resolution",
      paragraphs: [
        "These Terms are governed by applicable law in the jurisdiction where Sentra operates. Disputes should first be attempted through good-faith negotiation.",
      ],
    },
    {
      title: "13. Contact",
      paragraphs: ["If you have any questions about these Terms, please contact us at:"],
    },
  ],
  contactTeam: "Sentra Support Team",
  contactEmail: "support@phishguard.io",
};

const vi: TermsContent = {
  sections: [
    {
      title: "1. Chấp nhận điều khoản",
      paragraphs: [
        "Khi cài đặt, truy cập hoặc sử dụng tiện ích trình duyệt Sentra (\"Tiện ích\") hoặc nền tảng web liên quan (\"Dịch vụ\"), bạn (\"Người dùng\") đồng ý bị ràng buộc bởi Điều khoản & Thỏa thuận này. Nếu bạn không đồng ý toàn bộ điều khoản, vui lòng không cài đặt hoặc sử dụng Dịch vụ.",
      ],
    },
    {
      title: "2. Mô tả dịch vụ",
      paragraphs: [
        "Sentra là tiện ích trình duyệt giúp phát hiện và cảnh báo người dùng về các website phishing, liên kết độc hại và nội dung lừa đảo theo thời gian thực.",
        "Tiện ích hoạt động phía client và giao tiếp với backend để lấy threat intelligence cũng như gửi dữ liệu quét URL đã ẩn danh.",
      ],
    },
    {
      title: "3. Điều kiện sử dụng",
      paragraphs: [
        "Bạn phải từ 13 tuổi trở lên để sử dụng Dịch vụ. Nếu dưới 18 tuổi, cha mẹ hoặc người giám hộ hợp pháp phải xem xét và đồng ý các điều khoản này thay cho bạn.",
      ],
    },
    {
      title: "4. Tài khoản người dùng & đăng ký",
      paragraphs: [
        "Một số tính năng yêu cầu đăng ký tài khoản. Bạn cam kết cung cấp thông tin chính xác, đầy đủ và luôn cập nhật.",
        "Bạn tự chịu trách nhiệm bảo mật thông tin đăng nhập và mọi hoạt động phát sinh từ tài khoản của mình.",
      ],
    },
    {
      title: "5. Thu thập dữ liệu & quyền riêng tư",
      paragraphs: [
        "Việc sử dụng Dịch vụ của bạn tuân theo Chính sách Bảo mật, được dẫn chiếu như một phần của điều khoản này.",
        "Dữ liệu chúng tôi thu thập: URL đã ẩn danh, sự kiện tương tác tiện ích, metadata thiết bị và dữ liệu tài khoản do bạn tự cung cấp.",
        "Dữ liệu chúng tôi không thu thập: mật khẩu, nội dung form nhập liệu, thông tin thanh toán hoặc toàn bộ nội dung trang web.",
      ],
    },
    {
      title: "6. Phạm vi sử dụng được phép",
      paragraphs: ["Bạn chỉ được sử dụng Dịch vụ cho mục đích hợp pháp. Bạn không được:"],
      bullets: [
        "Reverse-engineer, decompile hoặc disassemble Tiện ích hay hệ thống backend.",
        "Dùng Dịch vụ để thực hiện phishing, gian lận hoặc hoạt động độc hại.",
        "Can thiệp hoặc làm gián đoạn tính toàn vẹn/hiệu năng của Dịch vụ.",
        "Gửi báo cáo mối đe dọa giả nhằm gây hại website hợp pháp.",
        "Vô hiệu hóa hoặc lách các cơ chế bảo mật.",
      ],
    },
    {
      title: "7. Quyền sở hữu trí tuệ",
      paragraphs: [
        "Mọi quyền sở hữu liên quan tới Tiện ích, Dịch vụ, phần mềm, mô hình ML và tài sản thương hiệu thuộc về hoặc được cấp phép cho Sentra.",
      ],
    },
    {
      title: "8. Tuyên bố miễn trừ & giới hạn trách nhiệm",
      paragraphs: [
        "DỊCH VỤ ĐƯỢC CUNG CẤP TRÊN CƠ SỞ \"NGUYÊN TRẠNG\" VÀ \"SẴN CÓ\", KHÔNG CÓ BẤT KỲ BẢO ĐẢM NÀO.",
        "Không có công cụ bảo mật nào chính xác tuyệt đối. Trong phạm vi luật cho phép, Sentra không chịu trách nhiệm cho các thiệt hại gián tiếp phát sinh từ việc sử dụng Dịch vụ.",
      ],
    },
    {
      title: "9. Bồi hoàn",
      paragraphs: [
        "Bạn đồng ý bồi hoàn và giữ cho Sentra cùng đội ngũ không bị tổn hại trước các khiếu nại phát sinh từ việc bạn sử dụng Dịch vụ hoặc vi phạm điều khoản.",
      ],
    },
    {
      title: "10. Chấm dứt",
      paragraphs: [
        "Chúng tôi có quyền tạm ngưng hoặc chấm dứt tài khoản/quyền truy cập của bạn bất kỳ lúc nào nếu vi phạm điều khoản hoặc lạm dụng nền tảng.",
      ],
    },
    {
      title: "11. Thay đổi điều khoản",
      paragraphs: [
        "Chúng tôi có thể cập nhật điều khoản theo từng thời điểm. Các thay đổi quan trọng sẽ được thông báo trước theo yêu cầu pháp lý.",
      ],
    },
    {
      title: "12. Luật áp dụng & giải quyết tranh chấp",
      paragraphs: [
        "Điều khoản này được điều chỉnh theo pháp luật áp dụng tại khu vực Sentra vận hành. Tranh chấp sẽ ưu tiên giải quyết thông qua thương lượng thiện chí.",
      ],
    },
    {
      title: "13. Liên hệ",
      paragraphs: ["Nếu bạn có câu hỏi về điều khoản này, vui lòng liên hệ:"],
    },
  ],
  contactTeam: "Đội ngũ hỗ trợ Sentra",
  contactEmail: "support@phishguard.io",
};

export function getTermsContent(locale: Locale): TermsContent {
  return locale === "vi" ? vi : en;
}
